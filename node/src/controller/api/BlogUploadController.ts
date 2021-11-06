import BlogUploadValidator from '../../validator/BlogUploadValiator.js';
import Controller from '../../Controller.js';
import ControllerInterface from '../../ControllerInterface.js';
import fs from 'fs';
import HttpBasicAuth from '../../util/HttpBasicAuth.js';
import MIMEParser from '@saekitominaga/mime-parser';
import { MediaW0SJp as ConfigureCommon } from '../../../configure/type/common';
import { NoName as Configure } from '../../../configure/type/blog-upload';
import { Request, Response } from 'express';

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
	 * @param {ConfigureCommon} configCommon - 共通設定
	 */
	constructor(configCommon: ConfigureCommon) {
		super();

		this.#configCommon = configCommon;
		this.#config = <Configure>JSON.parse(fs.readFileSync('node/configure/blog-upload.json', 'utf8'));
	}

	/**
	 * @param {Request} req - Request
	 * @param {Response} res - Response
	 */
	async execute(req: Request, res: Response): Promise<void> {
		/* Basic 認証 */
		const httpBasicAuth = new HttpBasicAuth(req);
		if (!(await httpBasicAuth.htpasswd(this.#configCommon.auth.htpasswd_file))) {
			res
				.status(401)
				.set('WWW-Authenticate', `Basic realm="${this.#configCommon.auth.realm}"`)
				.json(this.#configCommon.auth.json_401);
			return;
		}

		const validationResult = await new BlogUploadValidator(req).upload();
		if (!validationResult.isEmpty()) {
			this.logger.error('パラメーター不正', validationResult.array());

			const responseJson: ResponseJson = {
				name: req.body.name,
				size: req.body.size,
				code: this.#config.response.request_query.code,
				message: this.#config.response.request_query.message,
			};
			res.status(403).json(responseJson);
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
					this.#config.image.limit
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
					this.#config.video.limit
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

		res.status(200).json(responseJson);
	}

	/**
	 * ファイルアップロードを実行する（実際はアップロードされたファイルを media.w0s.jp の適切な場所に移動する）
	 *
	 * @param {string} fileName - ファイル名
	 * @param {string} tempPath - 仮で保存されたファイルパス
	 * @param {number} size - ファイルサイズ
	 * @param {string} fileDir - ファイルを保存するディレクトリ
	 * @param {boolean} overwrite - 上書きを許可するか
	 * @param {number} limitSize - 許可された最大サイズ
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
