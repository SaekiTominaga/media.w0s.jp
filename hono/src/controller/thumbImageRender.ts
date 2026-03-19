import fs from 'node:fs';
import path from 'node:path';
import { SqliteError } from 'better-sqlite3';
import { iec } from '@w0s/file-size-format';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { imageSizeFromFile } from 'image-size/fromFile';
import { env } from '@w0s/env-value-type';
import type { Variables } from '../app.ts';
import configHono from '../config/hono.ts';
import configThumbimage from '../config/thumb-image.ts';
import ThumbImageRenderDao from '../db/ThumbImageRender.ts';
import { corsAllowNoOrigin as corsMiddleware } from '../middleware/cors.ts';
import ThumbImage from '../object/ThumbImage.ts';
import ProcessTime from '../util/ProcessTime.ts';
import { getSize as getThumbImageSize, create as createThumbImage } from '../util/thumbImage.ts';
import { query as validatorQuery } from '../validator/thumbImageRender.ts';

/**
 * サムネイル画像表示
 */

/**
 * Fetch Mode のチェック
 *
 * @param context - Context
 *
 * @returns サムネイル画像の生成・表示を行う場合は true
 */
const checkFetchMode = (context: Context<{ Variables: Variables }>): boolean => {
	const { req, res } = context;
	const logger = context.get('logger');

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
const render = (context: Context<{ Variables: Variables }>, file: Readonly<{ data: Buffer; mimeType: string; mtime?: Date }>): Response => {
	const { req, res } = context;
	const logger = context.get('logger');
	const processTime = context.get('processTime');

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

	const response = context.body(Buffer.from(file.data));

	logger.info(`画像レスポンスデータ準備完了（${processTime.getTimeFormat()}）`);

	return response;
};

/**
 * 画像ファイル生成
 *
 * @param context - Context
 * @param origFileFullPath - 元画像ファイルのフルパス
 * @param thumbImage - サムネイル画像
 *
 * @returns 生成した画像データ
 */
const create = async (context: Context<{ Variables: Variables }>, origFileFullPath: string, thumbImage: ThumbImage): Promise<Buffer> => {
	const logger = context.get('logger');

	/* 新しい画像ファイルを生成 */
	const createProcessTime = new ProcessTime();
	const createdData = await createThumbImage(origFileFullPath, thumbImage);

	/* 生成後の処理 */
	const origSize = iec((await fs.promises.stat(origFileFullPath)).size, { digits: 1 });
	const createdSize = iec(createdData.byteLength, { digits: 1 });

	logger.info(`画像生成完了（${createProcessTime.getTimeFormat()}）: ${thumbImage.filePath} (${origSize} → ${createdSize})`);

	return createdData;
};

export const thumbImageRenderApp = new Hono<{ Variables: Variables }>().get('/:path{.+}', corsMiddleware, validatorQuery, async (context) => {
	const { req, res } = context;
	const logger = context.get('logger');

	const requestParam = req.param();
	const requestQuery = req.valid('query');

	const origFileFullPath = path.resolve(`${configHono.static.root}/${configHono.static.directory.image}/${requestParam.path}`);
	if (!fs.existsSync(origFileFullPath)) {
		throw new HTTPException(404, { message: 'File not found' });
	}

	if (!checkFetchMode(context)) {
		/* `<a href>`, `<img>` 等による呼び出し時はオリジナル画像ファイルを出力する */
		const extension = path.extname(origFileFullPath);
		const mimeType = Object.entries(configThumbimage.origMimeType)
			.find(([definedExtension]) => definedExtension === extension)
			?.at(1);
		if (mimeType === undefined) {
			throw new HTTPException(403, { message: `Unknown extension image (${extension})` });
		}

		const origFileReadProcessTime = new ProcessTime();
		const origFileData = await fs.promises.readFile(origFileFullPath);
		logger.debug(`オリジナル画像を読み込み: ${requestParam.path} (${origFileReadProcessTime.getTimeFormat()})`);

		res.headers.set('Content-Length', String(origFileData.byteLength));
		res.headers.set('Content-Type', mimeType);
		return context.body(Buffer.from(origFileData));
	}

	const origFileStatProcessTime = new ProcessTime();
	const origFileMtime = (await fs.promises.stat(origFileFullPath)).mtime;
	logger.debug(`オリジナル画像の情報を取得: ${requestParam.path} (${origFileStatProcessTime.getTimeFormat()})`);

	const dimensions = await imageSizeFromFile(origFileFullPath);

	const thumbImage = new ThumbImage(`${env('ROOT')}/${env('THUMBIMAGE_DIR')}`, {
		fileBasePath: requestParam.path,
		type: requestQuery.type,
		size: getThumbImageSize({ width: requestQuery.w, height: requestQuery.h }, { width: dimensions.width, height: dimensions.height }),
		quality: requestQuery.quality,
	});

	const thumbFileReadProcessTime = new ProcessTime();
	let thumbFileData: Buffer | undefined;
	try {
		thumbFileData = await fs.promises.readFile(thumbImage.fileFullPath);
		logger.debug(`サムネイル画像を読み込み: ${thumbImage.filePath} (${thumbFileReadProcessTime.getTimeFormat()})`);
	} catch (e) {
		if (!(e instanceof Error)) {
			throw e;
		}

		logger.debug(`サムネイル画像の読み込みに失敗: ${thumbImage.filePath} (${thumbFileReadProcessTime.getTimeFormat()})`);
	}

	if (thumbFileData !== undefined) {
		/* 画像ファイルが生成済みだった場合 */
		const thumbFileStatProcessTime = new ProcessTime();
		const thumbFileMtime = (await fs.promises.stat(thumbImage.fileFullPath)).mtime;
		logger.debug(`サムネイル画像の情報を取得: ${thumbImage.filePath} (${thumbFileStatProcessTime.getTimeFormat()})`);

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
					logger.info(
						`ファイル生成情報は DB 登録済み: ${thumbImage.fileBasePath} type:${thumbImage.type} size:${String(thumbImage.size.width)}x${String(thumbImage.size.width)} quality:${String(thumbImage.quality)}`,
					);
					break;
				}
				default: {
					throw e;
				}
			}
		}

		thumbImage.type = thumbTypeAlt;

		const thumbAltFileReadProcessTime = new ProcessTime();
		let thumbAltFileData: Buffer | undefined;
		try {
			thumbAltFileData = await fs.promises.readFile(thumbImage.fileFullPath);
			logger.debug(`サムネイル代替画像を読み込み: ${thumbImage.filePath} (${thumbAltFileReadProcessTime.getTimeFormat()})`);
		} catch (e) {
			if (!(e instanceof Error)) {
				throw e;
			}

			logger.debug(`サムネイル代替画像の読み込みに失敗: ${thumbImage.filePath} (${thumbFileReadProcessTime.getTimeFormat()})`);
		}
		if (thumbAltFileData !== undefined) {
			/* 代替画像ファイルが生成済みだった場合は、生成済みの画像データを表示 */
			logger.debug(`生成済みの代替画像を表示: ${thumbImage.filePath}`);

			const thumbAltFileStatProcessTime = new ProcessTime();
			const thumbAltFileMtime = (await fs.promises.stat(thumbImage.fileFullPath)).mtime;
			logger.debug(`サムネイル代替画像の情報を取得: ${thumbImage.filePath} (${thumbAltFileStatProcessTime.getTimeFormat()})`);

			return render(context, { data: thumbAltFileData, mimeType: thumbImage.mime, mtime: thumbAltFileMtime });
		}
	}

	/* 画像ファイル生成 */
	const createdData = await create(context, origFileFullPath, thumbImage);

	/* 生成した画像データを表示 */
	return render(context, { data: createdData, mimeType: thumbImage.mime });
});

export default thumbImageRenderApp;
