import Controller from '../../Controller.js';
import ControllerInterface from '../../ControllerInterface.js';
import FileSizeFormat from '@saekitominaga/file-size-format';
import fs from 'fs';
import HttpBasicAuth from '../../util/HttpBasicAuth.js';
import path from 'path';
import ThumbImage from '../../util/ThumbImage.js';
import ThumbImageValidator from '../../validator/ThumbImageValidator.js';
import ThumbImageUtil from '../../util/ThumbImageUtil.js';
import { MediaW0SJp as ConfigureCommon } from '../../../configure/type/common';
import { NoName as Configure } from '../../../configure/type/thumb-image';
import { Request, Response } from 'express';

/**
 * サムネイル画像生成
 */
export default class ThumbImageCreateController extends Controller implements ControllerInterface {
	#configCommon: ConfigureCommon;
	#config: Configure;

	/**
	 * @param {ConfigureCommon} configCommon - 共通設定
	 */
	constructor(configCommon: ConfigureCommon) {
		super();

		this.#configCommon = configCommon;
		this.#config = <Configure>JSON.parse(fs.readFileSync('node/configure/thumb-image.json', 'utf8'));
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

		const validationResult = await new ThumbImageValidator(req, this.#config).create();
		if (!validationResult.isEmpty()) {
			this.logger.error('パラメーター不正', validationResult.array());
			res.status(403).end();
			return;
		}

		const requestQuery: ThumbImageCreateRequest.Query = {
			file_path: req.body.file_path ?? null,
			type: req.body.type ?? null,
			width: Number(req.body.width),
			height: Number(req.body.height),
			quality: Number(req.body.quality),
		};

		const origFileFullPath = path.resolve(`${this.#configCommon.static.root}/${this.#configCommon.static.directory.image}/${requestQuery.file_path}`);
		if (!fs.existsSync(origFileFullPath)) {
			this.logger.info(`存在しないファイルパスが指定: ${requestQuery.file_path}`);
			res.status(403).end();
			return;
		}

		const thumbImage = new ThumbImage(
			this.#config.type,
			this.#config.thumb_dir,
			requestQuery.file_path,
			requestQuery.type,
			{
				width: requestQuery.width,
				height: requestQuery.height,
			},
			requestQuery.quality
		);

		/* 画像ファイル生成 */
		await this.create(origFileFullPath, thumbImage);

		res.status(204).end();
	}

	/**
	 * 画像ファイル生成
	 *
	 * @param {string} origFileFullPath - 元画像ファイルのフルパス
	 * @param {ThumbImage} thumbImage - サムネイル画像
	 *
	 * @returns {object} 生成した画像データ
	 */
	private async create(origFileFullPath: string, thumbImage: ThumbImage): Promise<Buffer> {
		/* 新しい画像ファイルを生成 */
		const createStartTime = Date.now();
		const createdFileData = await ThumbImageUtil.createImage(origFileFullPath, thumbImage);
		const createProcessingTime = Date.now() - createStartTime;

		/* 生成後の処理 */
		const origFileSize = FileSizeFormat.iec(fs.statSync(origFileFullPath).size, { digits: 1 });
		const createdFileSize = FileSizeFormat.iec(createdFileData.byteLength, { digits: 1 });

		this.logger.info(`画像生成完了（${Math.round(createProcessingTime / 1000)}秒）: ${thumbImage.filePath} （${origFileSize} → ${createdFileSize}）`);

		return createdFileData;
	}
}
