import fs from 'node:fs';
import MIMEParser from '@saekitominaga/mime-parser';
import type { Request, Response } from 'express';
import BlogValidator from '../../validator/BlogValiator.js';
import Controller from '../../Controller.js';
import type ControllerInterface from '../../ControllerInterface.js';
import HttpBasicAuth from '../../util/HttpBasicAuth.js';
import HttpResponse from '../../util/HttpResponse.js';
import type { MediaW0SJp as ConfigureCommon } from '../../../../configure/type/common.js';
import type { NoName as Configure } from '../../../../configure/type/blog-upload.js';

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
	#configCommon: ConfigureCommon;

	#config: Configure;

	/**
	 * @param configCommon - 共通設定
	 */
	constructor(configCommon: ConfigureCommon) {
		super();

		this.#configCommon = configCommon;
		this.#config = JSON.parse(fs.readFileSync('configure/blog-upload.json', 'utf8'));
	}

	/**
	 * @param req - Request
	 * @param res - Response
	 */
	async execute(req: Request, res: Response): Promise<void> {
		const httpResponse = new HttpResponse(res, this.#configCommon);

		/* Basic 認証 */
		const httpBasicAuth = new HttpBasicAuth(req);
		if (!(await httpBasicAuth.htpasswd(this.#configCommon.auth.htpasswd_file))) {
			httpResponse.send401Json('Basic', this.#configCommon.auth.realm);
			return;
		}

		const validationResult = await new BlogValidator(req).upload();
		if (!validationResult.isEmpty()) {
			this.logger.error('パラメーター不正', validationResult.array());

			const responseJson: ResponseJson = {
				name: req.body.name,
				size: req.body.size,
				code: this.#config.response.request_query.code,
				message: this.#config.response.request_query.message,
			};
			httpResponse.send403Json(responseJson);
			return;
		}

		const requestQuery: BlogUploadRequest.Query = {
			file_name: req.body.name,
			mime: req.body.type,
			temp_path: req.body.temppath,
			size: Number(req.body.size),
			overwrite: Boolean(req.body.overwrite),
		};

		let mimeType: string | undefined;
		try {
			mimeType = new MIMEParser(requestQuery.mime).getType();
		} catch (e) {}

		let responseJson: ResponseJson;
		switch (mimeType) {
			case 'image': {
				responseJson = await this.upload(
					requestQuery.file_name,
					requestQuery.temp_path,
					requestQuery.size,
					this.#config.image.dir,
					requestQuery.overwrite,
					this.#config.image.limit,
				);
				break;
			}
			case 'video': {
				responseJson = await this.upload(
					requestQuery.file_name,
					requestQuery.temp_path,
					requestQuery.size,
					this.#config.video.dir,
					requestQuery.overwrite,
					this.#config.video.limit,
				);
				break;
			}
			default: {
				this.logger.info('未対応のファイルタイプ', requestQuery.mime);

				responseJson = {
					name: requestQuery.file_name,
					size: requestQuery.size,
					code: this.#config.response.type.code,
					message: this.#config.response.type.message,
				};
			}
		}

		httpResponse.send200Json(responseJson);
	}

	/**
	 * ファイルアップロードを実行する（実際はアップロードされたファイルを media.w0s.jp の適切な場所に移動する）
	 *
	 * @param fileName - ファイル名
	 * @param tempPath - 仮で保存されたファイルパス
	 * @param size - ファイルサイズ
	 * @param fileDir - ファイルを保存するディレクトリ
	 * @param overwrite - 上書きを許可するか
	 * @param limitSize - 許可された最大サイズ
	 *
	 * @returns 返答内容
	 */
	private async upload(fileName: string, tempPath: string, size: number, fileDir: string, overwrite: boolean, limitSize: number): Promise<ResponseJson> {
		const filePath = `${fileDir}/${fileName}`;

		if (!overwrite && fs.existsSync(filePath)) {
			this.logger.info(`上書き禁止: ${fileName}`);

			return {
				name: fileName,
				size: size,
				code: this.#config.response.overwrite.code,
				message: this.#config.response.overwrite.message,
			};
		}

		if (size > limitSize) {
			this.logger.info(`ファイルサイズ超過: ${fileName}`);

			return {
				name: fileName,
				size: size,
				code: this.#config.response.size.code,
				message: this.#config.response.size.message,
			};
		}

		await fs.promises.rename(tempPath, filePath);
		this.logger.info(`ファイルアップロード成功: ${fileName}`);

		return {
			name: fileName,
			size: size,
			code: this.#config.response.success.code,
			message: this.#config.response.success.message,
		};
	}
}
