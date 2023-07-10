import fs from 'node:fs';
import path from 'node:path';
import FileSizeFormat from '@saekitominaga/file-size-format';
import type { Request, Response } from 'express';
import Controller from '../../Controller.js';
import type ControllerInterface from '../../ControllerInterface.js';
import HttpBasicAuth from '../../util/HttpBasicAuth.js';
import HttpResponse from '../../util/HttpResponse.js';
import ThumbImage from '../../util/ThumbImage.js';
import ThumbImageUtil from '../../util/ThumbImageUtil.js';
import ThumbImageValidator from '../../validator/ThumbImageValidator.js';
import type { MediaW0SJp as ConfigureCommon } from '../../../../configure/type/common.js';
import type { NoName as Configure } from '../../../../configure/type/thumb-image.js';

/**
 * サムネイル画像生成
 */
export default class ThumbImageCreateController extends Controller implements ControllerInterface {
	#configCommon: ConfigureCommon;

	#config: Configure;

	/**
	 * @param configCommon - 共通設定
	 */
	constructor(configCommon: ConfigureCommon) {
		super();

		this.#configCommon = configCommon;
		this.#config = JSON.parse(fs.readFileSync('configure/thumb-image.json', 'utf8'));
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

		const validationResult = await new ThumbImageValidator(req, this.#config).create();
		if (!validationResult.isEmpty()) {
			this.logger.error('パラメーター不正', validationResult.array());

			httpResponse.send403Json();
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

			httpResponse.send204(); // TODO: 正常時と区別が付かないので、本来は 200 にしてボディ内に情報を含めるべき
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

		httpResponse.send204();
	}

	/**
	 * 画像ファイル生成
	 *
	 * @param origFileFullPath - 元画像ファイルのフルパス
	 * @param thumbImage - サムネイル画像
	 *
	 * @returns 生成した画像データ
	 */
	private async create(origFileFullPath: string, thumbImage: ThumbImage): Promise<Buffer> {
		/* 新しい画像ファイルを生成 */
		const createStartTime = Date.now();
		const createdFileData = await ThumbImageUtil.createImage(origFileFullPath, thumbImage);
		const createProcessingTime = Date.now() - createStartTime;

		/* 生成後の処理 */
		const origFileSize = FileSizeFormat.iec((await fs.promises.stat(origFileFullPath)).size, { digits: 1 });
		const createdFileSize = FileSizeFormat.iec(createdFileData.byteLength, { digits: 1 });

		this.logger.info(`画像生成完了（${Math.round(createProcessingTime / 1000)}秒）: ${thumbImage.filePath} （${origFileSize} → ${createdFileSize}）`);

		return createdFileData;
	}
}
