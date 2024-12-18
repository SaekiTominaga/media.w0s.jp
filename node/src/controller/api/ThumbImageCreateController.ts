import fs from 'node:fs';
import path from 'node:path';
import FileSizeFormat from '@w0s/file-size-format';
import type { Request, Response } from 'express';
import configAuth from '../../config/auth.js';
import configExpress from '../../config/express.js';
import Controller from '../../Controller.js';
import type ControllerInterface from '../../ControllerInterface.js';
import HttpBasicAuth from '../../util/HttpBasicAuth.js';
import HttpResponse from '../../util/HttpResponse.js';
import ThumbImage from '../../util/ThumbImage.js';
import ThumbImageUtil from '../../util/ThumbImageUtil.js';
import ThumbImageValidator from '../../validator/ThumbImageValidator.js';

/**
 * サムネイル画像生成
 */
export default class ThumbImageCreateController extends Controller implements ControllerInterface {
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

		const validationResult = await new ThumbImageValidator(req).create();
		if (!validationResult.isEmpty()) {
			this.logger.error('パラメーター不正', validationResult.array());

			httpResponse.send403Json();
			return;
		}

		const requestQuery: ThumbImageCreateRequest.Query = {
			file_path: req.body['file_path'] as string,
			type: req.body['type'] as string,
			width: Number(req.body['width']),
			height: Number(req.body['height']),
			quality: Number(req.body['quality']),
		};

		const origFileFullPath = path.resolve(`${configExpress.static.root}/${configExpress.static.directory.image}/${requestQuery.file_path}`);
		if (!fs.existsSync(origFileFullPath)) {
			this.logger.info(`存在しないファイルパスが指定: ${requestQuery.file_path}`);

			httpResponse.send204(); // TODO: 正常時と区別が付かないので、本来は 200 にしてボディ内に情報を含めるべき
			return;
		}

		const thumbImage = new ThumbImage({
			fileBasePath: requestQuery.file_path,
			type: requestQuery.type,
			size: {
				width: requestQuery.width,
				height: requestQuery.height,
			},
			quality: requestQuery.quality,
		});

		/* 画像ファイル生成 */
		await this.#create(origFileFullPath, thumbImage);

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
	async #create(origFileFullPath: string, thumbImage: ThumbImage): Promise<Buffer> {
		/* 新しい画像ファイルを生成 */
		const createStartTime = Date.now();
		const createdFileData = await ThumbImageUtil.createImage(origFileFullPath, thumbImage);
		const createProcessingTime = Date.now() - createStartTime;

		/* 生成後の処理 */
		const origFileSize = FileSizeFormat.iec((await fs.promises.stat(origFileFullPath)).size, { digits: 1 });
		const createdFileSize = FileSizeFormat.iec(createdFileData.byteLength, { digits: 1 });

		this.logger.info(`画像生成完了（${String(Math.round(createProcessingTime / 1000))}秒）: ${thumbImage.filePath} （${origFileSize} → ${createdFileSize}）`);

		return createdFileData;
	}
}
