import fs from 'node:fs';
import { Hono } from 'hono';
import Log4js from 'log4js';
import MIMEType from 'whatwg-mimetype';
import configBlogUpload from '../config/blog-upload.js';
import { json as validatorJson } from '../validator/blogUpload.js';

interface ResponseJson {
	name: string;
	size: number;
	code: number;
	message: string;
}

/**
 * ブログ用ファイルアップロード
 */
const logger = Log4js.getLogger('blog-upload');

/**
 * ファイルアップロードを実行する（正確にはアップロードされたファイルを `media.w0s.jp` の適切な場所に移動する）
 *
 * @param option - あらかじめ定義された情報
 * @param option.dir - 移動先ディレクトリ
 * @param option.limit - 取り扱うファイルサイズのリミット
 * @param requset - リクエストで指定された情報
 * @param requset.fileName - ファイル名
 * @param requset.tempPath - 仮で保存されたファイルパス
 * @param requset.size - ファイルサイズ
 * @param requset.overwrite - 上書きを許可するか
 *
 * @returns 返答内容
 */
const upload = async (
	option: { dir: string; limit: number },
	requset: { fileName: string; tempPath: string; size: number; overwrite: boolean },
): Promise<ResponseJson> => {
	const filePath = `${option.dir}/${requset.fileName}`;

	if (!requset.overwrite && fs.existsSync(filePath)) {
		logger.info(`上書き禁止: ${requset.fileName}`);

		return {
			name: requset.fileName,
			size: requset.size,
			code: configBlogUpload.response.overwrite.code,
			message: configBlogUpload.response.overwrite.message,
		};
	}

	if (requset.size > option.limit) {
		logger.info(`ファイルサイズ超過: ${requset.fileName}`);

		return {
			name: requset.fileName,
			size: requset.size,
			code: configBlogUpload.response.size.code,
			message: configBlogUpload.response.size.message,
		};
	}

	logger.debug(`ファイルアップロード実施: ${requset.tempPath} → ${filePath}`);
	await fs.promises.rename(requset.tempPath, filePath);
	logger.info(`ファイルアップロード成功: ${filePath}`);

	return {
		name: requset.fileName,
		size: requset.size,
		code: configBlogUpload.response.success.code,
		message: configBlogUpload.response.success.message,
	};
};

export const blogUploadApp = new Hono().post(validatorJson, async (context) => {
	const { req } = context;

	const requestBody = req.valid('json');

	let response: ResponseJson;
	switch (new MIMEType(requestBody.type).type) {
		case 'image': {
			response = await upload(
				{
					dir: configBlogUpload.image.dir,
					limit: configBlogUpload.image.limit,
				},
				{
					fileName: requestBody.fileName,
					tempPath: requestBody.tempPath,
					size: requestBody.size,
					overwrite: requestBody.overwrite,
				},
			);
			break;
		}
		case 'video': {
			response = await upload(
				{
					dir: configBlogUpload.video.dir,
					limit: configBlogUpload.video.limit,
				},
				{
					fileName: requestBody.fileName,
					tempPath: requestBody.tempPath,
					size: requestBody.size,
					overwrite: requestBody.overwrite,
				},
			);
			break;
		}
		default: {
			logger.info('未対応のファイルタイプ', requestBody.type);

			response = {
				name: requestBody.fileName,
				size: requestBody.size,
				code: configBlogUpload.response.type.code,
				message: configBlogUpload.response.type.message,
			};
		}
	}

	return context.json(response);
});
