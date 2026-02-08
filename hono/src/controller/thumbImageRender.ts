import fs from 'node:fs';
import path from 'node:path';
import { SqliteError } from 'better-sqlite3';
import { iec } from '@w0s/file-size-format';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { imageSize } from 'image-size';
import Log4js from 'log4js';
import { env } from '@w0s/env-value-type';
import configHono from '../config/hono.ts';
import configThumbimage from '../config/thumb-image.ts';
import ThumbImageRenderDao from '../db/ThumbImageRender.ts';
import { corsAllowNoOrigin as corsMiddleware } from '../middleware/cors.ts';
import ThumbImage from '../object/ThumbImage.ts';
import { getSize as getThumbImageSize, create as createThumbImage } from '../util/thumbImage.ts';
import { query as validatorQuery } from '../validator/thumbImageRender.ts';

/**
 * サムネイル画像表示
 */
const logger = Log4js.getLogger('thumbimage');

/**
 * Fetch Mode のチェック
 *
 * @param context - Context
 *
 * @returns サムネイル画像の生成・表示を行う場合は true
 */
const checkFetchMode = (context: Context): boolean => {
	const { req, res } = context;

	const fetchMode = req.header('Sec-Fetch-Mode');
	res.headers.append('Vary', 'Sec-Fetch-Mode');

	logger.debug(`Sec-Fetch-Mode: ${String(fetchMode)}`);

	return fetchMode === 'cors'; // `cors = <img crossorigin>` による呼び出し
};

/**
 * 画像ファイルを画面に出力する
 *
 * @param context - Context
 * @param file - 画像ファイル
 * @param file.data - 画像データ
 * @param file.mimeType - MIME タイプ
 * @param file.mtime - 最終更新日時
 *
 * @returns Response
 */
const render = (context: Context, file: Readonly<{ data: Buffer; mimeType: string; mtime?: Date }>): Response => {
	const { req, res } = context;

	if (file.mtime !== undefined) {
		/* キャッシュ確認 */
		const ifModifiedSince = req.header('If-Modified-Since');
		if (ifModifiedSince !== undefined && file.mtime <= new Date(ifModifiedSince)) {
			return new Response(null, { status: 304 });
		}

		res.headers.set('Last-Modified', file.mtime.toUTCString());
	}

	res.headers.set('Cache-Control', configThumbimage.cacheControl);
	res.headers.set('Content-Length', String(file.data.byteLength));
	res.headers.set('Content-Type', file.mimeType);

	return context.body(Buffer.from(file.data));
};

/**
 * 画像ファイル生成
 *
 * @param origFileFullPath - 元画像ファイルのフルパス
 * @param thumbImage - サムネイル画像
 *
 * @returns 生成した画像データ
 */
const create = async (origFileFullPath: string, thumbImage: ThumbImage): Promise<Buffer> => {
	/* 新しい画像ファイルを生成 */
	const startTime = Date.now();
	const createdData = await createThumbImage(origFileFullPath, thumbImage);
	const processingTime = Date.now() - startTime;

	/* 生成後の処理 */
	const origSize = iec((await fs.promises.stat(origFileFullPath)).size, { digits: 1 });
	const createdSize = iec(createdData.byteLength, { digits: 1 });

	logger.info(`画像生成完了（${String(Math.round(processingTime / 1000))}秒）: ${thumbImage.filePath} （${origSize} → ${createdSize}）`);

	return createdData;
};

export const thumbImageRenderApp = new Hono().get('/:path{.+}', corsMiddleware, validatorQuery, async (context) => {
	const { req, res } = context;

	const requestParam = req.param();
	const requestQuery = req.valid('query');

	const origFileFullPath = path.resolve(`${configHono.static.root}/${configHono.static.directory.image}/${requestParam.path}`);
	if (!fs.existsSync(origFileFullPath)) {
		throw new HTTPException(404, { message: 'File not found' });
	}

	const origFileData = await fs.promises.readFile(origFileFullPath);

	if (!checkFetchMode(context)) {
		/* `<a href>`, `<img>` 等による呼び出し時はオリジナル画像ファイルを出力する */
		const extension = path.extname(origFileFullPath);
		const mimeType = Object.entries(configThumbimage.origMimeType)
			.find(([definedExtension]) => definedExtension === extension)
			?.at(1);
		if (mimeType === undefined) {
			throw new HTTPException(403, { message: `Unknown extension image (${extension})` });
		}

		res.headers.set('Content-Length', String(origFileData.byteLength));
		res.headers.set('Content-Type', mimeType);
		return context.body(Buffer.from(origFileData));
	}

	const origFileMtime = (await fs.promises.stat(origFileFullPath)).mtime;

	const dimensions = imageSize(origFileData);

	const thumbImage = new ThumbImage(`${env('ROOT')}/${env('THUMBIMAGE_DIR')}`, {
		fileBasePath: requestParam.path,
		type: requestQuery.type,
		size: getThumbImageSize({ width: requestQuery.w, height: requestQuery.h }, { width: dimensions.width, height: dimensions.height }),
		quality: requestQuery.quality,
	});

	let thumbFileData: Buffer | undefined;
	try {
		thumbFileData = await fs.promises.readFile(thumbImage.fileFullPath);
	} catch (e) {}

	if (thumbFileData !== undefined) {
		/* 画像ファイルが生成済みだった場合 */
		const thumbFileMtime = fs.statSync(thumbImage.fileFullPath).mtime;

		if (origFileMtime <= thumbFileMtime) {
			/* 生成済みの画像データを表示 */
			logger.debug(`生成済みの画像を表示: ${thumbImage.filePath}`);

			return render(context, { data: thumbFileData, mimeType: thumbImage.mime, mtime: thumbFileMtime });
		}

		/* 元画像が更新されている場合 */
		logger.info(`画像が生成済みだが、元画像が更新されているので差し替える: ${req.url}`);
	}

	const thumbTypeAlt = thumbImage.altType;
	if (thumbTypeAlt !== undefined) {
		/* 代替タイプが設定されている場合はリアルタイム生成を行わず、ファイル生成情報を DB に登録する（別途、バッチ処理でファイル生成を行うため） */
		const dao = new ThumbImageRenderDao(`${env('ROOT')}/${env('SQLITE_DIR')}/${env('SQLITE_THUMBIMAGE')}`);
		try {
			const insertedCount = await dao.insert({
				file_path: thumbImage.fileBasePath,
				file_type: thumbImage.type,
				width: thumbImage.size.width,
				height: thumbImage.size.height,
				quality: thumbImage.quality,
			});
			if (insertedCount > 0) {
				logger.info(`ファイル生成情報を DB に登録: ${thumbImage.fileBasePath}`);
			}
		} catch (e) {
			if (!(e instanceof SqliteError)) {
				throw e;
			}

			switch (e.code /* https://sqlite.org/rescode.html */) {
				case 'SQLITE_CONSTRAINT_UNIQUE': {
					logger.info('ファイル生成情報は DB 登録済み', thumbImage.fileBasePath, thumbImage.type, thumbImage.size, thumbImage.quality);
					break;
				}
				default: {
					throw e;
				}
			}
		}

		thumbImage.type = thumbTypeAlt;

		let thumbFileDataAlt: Buffer | undefined;
		try {
			thumbFileDataAlt = await fs.promises.readFile(thumbImage.fileFullPath);
		} catch (e) {}
		if (thumbFileDataAlt !== undefined) {
			/* 代替画像ファイルが生成済みだった場合は、生成済みの画像データを表示 */
			logger.debug(`生成済みの代替画像を表示: ${thumbImage.filePath}`);

			const thumbFileMtime = fs.statSync(thumbImage.fileFullPath).mtime;
			return render(context, { data: thumbFileDataAlt, mimeType: thumbImage.mime, mtime: thumbFileMtime });
		}
	}

	/* 画像ファイル生成 */
	const createdData = await create(origFileFullPath, thumbImage);

	/* 生成した画像データを表示 */
	return render(context, { data: createdData, mimeType: thumbImage.mime });
});

export default thumbImageRenderApp;
