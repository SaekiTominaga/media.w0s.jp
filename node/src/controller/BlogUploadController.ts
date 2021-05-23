import auth from 'basic-auth';
import Controller from '../Controller.js';
import ControllerInterface from '../ControllerInterface.js';
import fs from 'fs';
// @ts-expect-error: ts(7016)
import htpasswd from 'htpasswd-js';
import MIMEParser from '@saekitominaga/mime-parser';
import { MediaW0SJp as ConfigureCommon } from '../../configure/type/common';
import { NoName as Configure } from '../../configure/type/blog-upload';
import { Request, Response } from 'express';

interface ResponseJson {
	name: string;
	size: number;
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
		const credentials = auth(req);
		if (
			credentials === undefined ||
			!(await htpasswd.authenticate({
				username: credentials.name,
				password: credentials.pass,
				file: this.#configCommon.auth.htpasswd_file,
			}))
		) {
			res
				.status(401)
				.set('WWW-Authenticate', `Basic realm="${this.#configCommon.auth.realm}"`)
				.json(this.#configCommon.auth.json_401);
			return;
		}

		const requestBody = req.body;
		const fileName: string = requestBody.name;
		const mime: string = requestBody.type;
		const tempPath: string = requestBody.temppath;
		const size = Number(requestBody.size);
		const overwrite = Boolean(requestBody.overwrite);

		let responseJson: ResponseJson;

		switch (new MIMEParser(mime).getType()) {
			case 'image': {
				responseJson = await this.upload(fileName, tempPath, size, this.#config.image.dir, overwrite, this.#config.image.limit);
				break;
			}
			case 'video': {
				responseJson = await this.upload(fileName, tempPath, size, this.#config.video.dir, overwrite, this.#config.video.limit);
				break;
			}
			default: {
				this.logger.info(`未対応のファイルタイプ: ${mime}`);

				responseJson = {
					name: fileName,
					size: size,
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
