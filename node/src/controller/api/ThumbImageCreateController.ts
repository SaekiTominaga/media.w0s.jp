import Controller from '../../Controller.js';
import ControllerInterface from '../../ControllerInterface.js';
import FileSizeFormat from '@saekitominaga/file-size-format';
import fs from 'fs';
import HttpBasicAuth from '../../util/HttpBasicAuth.js';
import path from 'path';
import ThumbImage from '../../util/ThumbImage.js';
import ThumbImageCreateValidator from '../../validator/ThumbImageCreateValidator.js';
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

		const validationResult = await new ThumbImageCreateValidator(req, this.#config).display();
		if (!validationResult.isEmpty()) {
			this.logger.error('パラメーター不正', validationResult.array());
			res.status(403).end();
			return;
		}

		const requestQuery: ThumbImageCreateRequest.Query = {
			path: req.body.path ?? null,
			type: req.body.type ?? null,
			width: Number(req.body.width),
			height: Number(req.body.height),
			quality: Number(req.body.quality),
		};

		const origFilePath = path.resolve(`${this.#configCommon.static.root}/${this.#configCommon.static.directory.image}/${requestQuery.path}`);
		if (!fs.existsSync(origFilePath)) {
			this.logger.info(`存在しないファイルパスが指定: ${requestQuery.path}`);
			res.status(403).end();
			return;
		}

		const thumbFileName = ThumbImage.getThumbFileName(
			requestQuery.path,
			requestQuery.type,
			requestQuery.quality,
			{
				width: requestQuery.width,
				height: requestQuery.height,
			},
			this.#config.type
		);
		const thumbFilePath = path.resolve(`${this.#config.thumb_dir}/${thumbFileName}`);

		/* 新しい画像ファイルを生成 */
		const createStartTime = Date.now();
		await ThumbImage.createImage(origFilePath, {
			path: thumbFilePath,
			type: requestQuery.type,
			width: requestQuery.width,
			height: requestQuery.height,
			quality: requestQuery.quality,
		});
		const createProcessingTime = Date.now() - createStartTime;

		/* 生成後の処理 */
		const origFileSize = fs.statSync(origFilePath).size;
		const origFileSizeIec = FileSizeFormat.iec(origFileSize, { digits: 1 });
		const createdFileSize = fs.statSync(thumbFilePath).size;
		const createdFileSizeIec = FileSizeFormat.iec(createdFileSize, { digits: 1 });

		this.logger.info(`画像生成完了（${Math.round(createProcessingTime / 1000)}秒）: ${thumbFileName} （${origFileSizeIec} → ${createdFileSizeIec}）`);

		res.status(204).end();
	}
}
