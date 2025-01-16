import fs from 'node:fs';
import path from 'node:path';
import FileSizeFormat from '@w0s/file-size-format';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { imageSize } from 'image-size';
import Log4js from 'log4js';
import configHono from '../config/hono.js';
import configSqlite from '../config/sqlite.js';
import configThumbimage from '../config/thumb-image.js';
import ThumbImageRenderDao from '../dao/ThumbImageRenderDao.js';
import { cors as corsMiddleware } from '../middleware/cors.js';
import ThumbImage from '../object/ThumbImage.js';
import { getSize as getThumbImageSize, create as createThumbImage } from '../util/thumbImage.js';
import { query as validatorQuery } from '../validator/thumbImageRender.js';

/**
 * サムネイル画像表示
 */
const logger = Log4js.getLogger('thumbimage');

/**
 * 出力するファイルの大きさを計算する
 *
 * @param requestSize - リクエストされた画像サイズ
 * @param requestSize.width - 幅
 * @param requestSize.height - 高さ
 * @param origFileFullPath - 元画像ファイルのフルパス
 *
 * @returns 出力するサムネイル画像ファイルの大きさ
 */
const getSize = (
	requestSize: Readonly<{
		width: number | undefined;
		height: number | undefined;
	}>,
	origFileFullPath: string,
): ImageSize | null => {
	let origImageWidth: number | undefined;
	let origImageHeight: number | undefined;
	try {
		const dimensions = imageSize(origFileFullPath);
		origImageWidth = dimensions.width;
		origImageHeight = dimensions.height;
	} catch (e) {
		logger.warn(e);
		return null;
	}

	if (origImageWidth === undefined || origImageHeight === undefined) {
		return null;
	}

	return getThumbImageSize(requestSize, { width: origImageWidth, height: origImageHeight });
};

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
			return new Response(null, {
				status: 304,
			});
		}

		res.headers.set('Last-Modified', file.mtime.toUTCString());
	}

	res.headers.set('Cache-Control', configThumbimage.cacheControl);
	res.headers.set('Content-Length', String(file.data.byteLength));
	res.headers.set('Content-Type', file.mimeType);

	return context.body(file.data);
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
	const origSize = FileSizeFormat.iec((await fs.promises.stat(origFileFullPath)).size, { digits: 1 });
	const createdSize = FileSizeFormat.iec(createdData.byteLength, { digits: 1 });

	logger.info(`画像生成完了（${String(Math.round(processingTime / 1000))}秒）: ${thumbImage.filePath} （${origSize} → ${createdSize}）`);

	return createdData;
};

const app = new Hono().get('/:path{.+}', corsMiddleware, validatorQuery, async (context) => {
	const { req, res } = context;

	const requestParam = req.param();
	const requestQuery = req.valid('query');

	const origFileFullPath = path.resolve(`${configHono.static.root}/${configHono.static.directory.image}/${requestParam.path}`);
	if (!fs.existsSync(origFileFullPath)) {
		throw new HTTPException(404, { message: 'File not found' });
	}

	const thumbSize = getSize({ width: requestQuery.w, height: requestQuery.h }, origFileFullPath);
	if (thumbSize === null) {
		throw new HTTPException(403, { message: 'サイズが取得できない画像が指定' });
	}

	if (!checkFetchMode(context)) {
		/* `<a href>`, `<img>` 等による呼び出し時はオリジナル画像ファイルを出力する */
		const fileData = await fs.promises.readFile(origFileFullPath);

		const extension = path.extname(origFileFullPath);
		const mimeType = Object.entries(configThumbimage.origMimeType)
			.find(([definedExtension]) => definedExtension === extension)
			?.at(1);
		if (mimeType === undefined) {
			throw new HTTPException(403, { message: `Unknown extension image (${extension})` });
		}

		res.headers.set('Content-Length', String(fileData.byteLength));
		res.headers.set('Content-Type', mimeType);
		return context.body(fileData);
	}

	const origFileMtime = (await fs.promises.stat(origFileFullPath)).mtime;

	const thumbImage = new ThumbImage(process.env['THUMBIMAGE_DIR'], {
		fileBasePath: requestParam.path,
		type: requestQuery.type,
		size: thumbSize,
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
		const dbFilePath = process.env['SQLITE_THUMBIMAGE'];
		if (dbFilePath === undefined) {
			throw new Error('thumbimage DB file path not defined');
		}

		const dao = new ThumbImageRenderDao(dbFilePath);
		try {
			const insertedCount = await dao.insert({
				filePath: thumbImage.fileBasePath,
				type: thumbImage.type,
				size: thumbImage.size,
				quality: thumbImage.quality,
			});
			if (insertedCount > 0) {
				logger.info(`ファイル生成情報を DB に登録: ${thumbImage.fileBasePath}`);
			}
		} catch (e) {
			if (!(e instanceof Error)) {
				throw e;
			}

			// @ts-expect-error: ts(2339)
			switch (e.errno) {
				case configSqlite.errno.locked: {
					logger.warn('DB ロック', thumbImage.fileBasePath, thumbImage.type, thumbImage.size, thumbImage.quality);
					break;
				}
				case configSqlite.errno.uniqueConstraint: {
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

export default app;
