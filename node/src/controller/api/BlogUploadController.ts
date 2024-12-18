import fs from 'node:fs';
import type { Request, Response } from 'express';
import MIMEType from 'whatwg-mimetype';
import configAuth from '../../config/auth.js';
import configBlogUpload from '../../config/blog-upload.js';
import BlogValidator from '../../validator/BlogValiator.js';
import Controller from '../../Controller.js';
import type ControllerInterface from '../../ControllerInterface.js';
import HttpBasicAuth from '../../util/HttpBasicAuth.js';
import HttpResponse from '../../util/HttpResponse.js';

interface ResponseJson {
	name: string | null;
	size: number | null;
	code: number;
	message: string;
}

/**
 * ブログ用ファイルアップロード
 */
export default class BlogUploadController extends Controller implements ControllerInterface {
	/**
	 * @param req - Request
	 * @param res - Response
	 */
	async execute(req: Request, res: Response): Promise<void> {
		const httpResponse = new HttpResponse(res);

		/* Basic 認証 */
		const htpasswdFilePath = process.env['AUTH_HTPASSWD'];
		if (htpasswdFilePath === undefined) {
			throw new Error('htpasswd file path not defined');
		}

		const httpBasicAuth = new HttpBasicAuth(req);
		if (!(await httpBasicAuth.htpasswd(htpasswdFilePath))) {
			httpResponse.send401Json('Basic', configAuth.realm);
			return;
		}

		const validationResult = await new BlogValidator(req).upload();
		if (!validationResult.isEmpty()) {
			this.logger.error('パラメーター不正', validationResult.array());

			const responseJson: ResponseJson = {
				name: req.body.name as string,
				size: Number(req.body.size),
				code: configBlogUpload.response.requestQuery.code,
				message: configBlogUpload.response.requestQuery.message,
			};
			httpResponse.send403Json(responseJson);
			return;
		}

		const requestQuery: BlogUploadRequest.Query = {
			file_name: req.body.name as string,
			mime: req.body.type as string,
			temp_path: req.body.temppath as string,
			size: Number(req.body.size),
			overwrite: Boolean(req.body.overwrite),
		};

		let responseJson: ResponseJson;
		switch (new MIMEType(requestQuery.mime).type) {
			case 'image': {
				responseJson = await this.#upload({
					fileName: requestQuery.file_name,
					temp: requestQuery.temp_path,
					size: requestQuery.size,
					overwrite: requestQuery.overwrite,
				});
				break;
			}
			case 'video': {
				responseJson = await this.#upload({
					fileName: requestQuery.file_name,
					temp: requestQuery.temp_path,
					size: requestQuery.size,
					overwrite: requestQuery.overwrite,
				});
				break;
			}
			default: {
				this.logger.info('未対応のファイルタイプ', requestQuery.mime);

				responseJson = {
					name: requestQuery.file_name,
					size: requestQuery.size,
					code: configBlogUpload.response.type.code,
					message: configBlogUpload.response.type.message,
				};
			}
		}

		httpResponse.send200Json(responseJson);
	}

	/**
	 * ファイルアップロードを実行する（実際はアップロードされたファイルを media.w0s.jp の適切な場所に移動する）
	 *
	 * @param option -
	 * @param option.fileName - ファイル名
	 * @param option.temp - 仮で保存されたファイルパス
	 * @param option.size - ファイルサイズ
	 * @param option.overwrite - 上書きを許可するか
	 *
	 * @returns 返答内容
	 */
	async #upload(option: { fileName: string; temp: string; size: number; overwrite: boolean }): Promise<ResponseJson> {
		const filePath = `${configBlogUpload.image.dir}/${option.fileName}`;

		if (!option.overwrite && fs.existsSync(filePath)) {
			this.logger.info(`上書き禁止: ${option.fileName}`);

			return {
				name: option.fileName,
				size: option.size,
				code: configBlogUpload.response.overwrite.code,
				message: configBlogUpload.response.overwrite.message,
			};
		}

		if (option.size > configBlogUpload.video.limit) {
			this.logger.info(`ファイルサイズ超過: ${option.fileName}`);

			return {
				name: option.fileName,
				size: option.size,
				code: configBlogUpload.response.size.code,
				message: configBlogUpload.response.size.message,
			};
		}

		await fs.promises.rename(option.temp, filePath);
		this.logger.info(`ファイルアップロード成功: ${option.fileName}`);

		return {
			name: option.fileName,
			size: option.size,
			code: configBlogUpload.response.success.code,
			message: configBlogUpload.response.success.message,
		};
	}
}
