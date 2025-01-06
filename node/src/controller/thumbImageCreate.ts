import fs from 'node:fs';
import path from 'node:path';
import FileSizeFormat from '@w0s/file-size-format';
import { Hono } from 'hono';
import Log4js from 'log4js';
import configExpress from '../config/hono.js';
import ThumbImage from '../object/ThumbImage.js';
import { create as createThumbImage } from '../util/thumbImage.js';
import { json as validatorJson } from '../validator/thumbImageCreate.js';

/**
 * サムネイル画像生成
 */
const logger = Log4js.getLogger('thumbimage-create');

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

const app = new Hono().post('/', validatorJson, async (context) => {
	const { req } = context;

	const requestBody = req.valid('json');

	const origFileFullPath = path.resolve(`${configExpress.static.root}/${configExpress.static.directory.image}/${requestBody.filePath}`);
	if (!fs.existsSync(origFileFullPath)) {
		logger.info(`存在しないファイルパスが指定: ${requestBody.filePath}`);

		return new Response(null, { status: 204 }); // TODO: 正常時と区別が付かないので、本来は 200 にしてボディ内に情報を含めるべき
	}

	const thumbImage = new ThumbImage(process.env['THUMBIMAGE_DIR'], {
		fileBasePath: requestBody.filePath,
		type: requestBody.type,
		size: {
			width: requestBody.width,
			height: requestBody.height,
		},
		quality: requestBody.quality,
	});

	/* 画像ファイル生成 */
	await create(origFileFullPath, thumbImage);

	return new Response(null, { status: 204 });
});

export default app;
