import fs from 'node:fs';
import path from 'node:path';
import FileSizeFormat from '@w0s/file-size-format';
import type { Request, Response } from 'express';
import { imageSize } from 'image-size';
import configExpress from '../config/express.js';
import configSqlite from '../config/sqlite.js';
import configThumbimage from '../config/thumb-image.js';
import Controller from '../Controller.js';
import type ControllerInterface from '../ControllerInterface.js';
import HttpResponse from '../util/HttpResponse.js';
import ThumbImage from '../util/ThumbImage.js';
import ThumbImageRenderDao from '../dao/ThumbImageRenderDao.js';
import ThumbImageValidator from '../validator/ThumbImageValidator.js';
import ThumbImageUtil from '../util/ThumbImageUtil.js';

/**
 * サムネイル画像表示
 */
export default class ThumbImageRenderController extends Controller implements ControllerInterface {
	/**
	 * @param req - Request
	 * @param res - Response
	 */
	async execute(req: Request, res: Response): Promise<void> {
		const httpResponse = new HttpResponse(res);

		const validationResult = await new ThumbImageValidator(req).render();
		if (!validationResult.isEmpty()) {
			this.logger.warn('パラメーター不正', validationResult.array());
			httpResponse.send403();
			return;
		}

		const requestQuery: ThumbImageRequest.Query = {
			path: req.params['path']!, // app.js 内の処理により path パラメーターは必ず存在する想定
			type: this.#decideType(req),
			width: req.query['w'] !== undefined ? Number(req.query['w']) : null,
			height: req.query['h'] !== undefined ? Number(req.query['h']) : null,
			quality: req.query['quality'] !== undefined ? Number(req.query['quality']) : configThumbimage.qualityDefault,
		};

		const origFileFullPath = path.resolve(`${configExpress.static.root}/${configExpress.static.directory.image}/${requestQuery.path}`);
		if (!fs.existsSync(origFileFullPath)) {
			this.logger.warn(`存在しないファイルパスが指定: ${req.url}`);
			httpResponse.send404();
			return;
		}

		const thumbSize = this.#getSize(requestQuery, origFileFullPath);
		if (thumbSize === null) {
			this.logger.warn(`サイズが取得できない画像が指定: ${req.url}`);
			httpResponse.send403();
			return;
		}

		if (!(await this.#cors(req, res, httpResponse, origFileFullPath))) {
			return;
		}

		const origFileMtime = (await fs.promises.stat(origFileFullPath)).mtime;

		const thumbImage = new ThumbImage({
			fileBasePath: requestQuery.path,
			type: requestQuery.type,
			size: thumbSize,
			quality: requestQuery.quality,
		});

		let thumbFileData: Buffer | undefined;
		try {
			thumbFileData = await fs.promises.readFile(thumbImage.fileFullPath);
		} catch (e) {}

		if (thumbFileData !== undefined) {
			/* 画像ファイルが生成済みだった場合 */
			const thumbFileMtime = fs.statSync(thumbImage.fileFullPath).mtime;

			if (origFileMtime <= thumbFileMtime) {
				/* 生成済みの画像データを表示 */
				this.logger.debug(`生成済みの画像を表示: ${thumbImage.filePath}`);

				this.#response(req, res, httpResponse, thumbImage.mime, thumbFileData, thumbFileMtime);
				return;
			}

			/* 元画像が更新されている場合 */
			this.logger.info(`画像が生成済みだが、元画像が更新されているので差し替える: ${req.url}`);
		}

		const thumbTypeAlt = thumbImage.altType;
		if (thumbTypeAlt !== undefined) {
			/* 代替タイプが設定されている場合はリアルタイム生成を行わず、ファイル生成情報を DB に登録する（別途、バッチ処理でファイル生成を行うため） */
			const dbFilePath = process.env['SQLITE_THUMBIMAGE'];
			if (dbFilePath === undefined) {
				throw new Error('thumbimage DB file path not defined');
			}

			const dao = new ThumbImageRenderDao(dbFilePath);
			try {
				const insertedCount = await dao.insert(thumbImage.fileBasePath, thumbImage.type, thumbImage.size, thumbImage.quality);
				if (insertedCount > 0) {
					this.logger.info(`ファイル生成情報を DB に登録: ${thumbImage.fileBasePath}`);
				}
			} catch (e) {
				if (!(e instanceof Error)) {
					throw e;
				}

				// @ts-expect-error: ts(2339)
				switch (e.errno) {
					case configSqlite.errno.locked: {
						this.logger.warn('DB ロック', thumbImage.fileBasePath, thumbImage.type, thumbImage.size, thumbImage.quality);
						break;
					}
					case configSqlite.errno.uniqueConstraint: {
						this.logger.info('ファイル生成情報は DB 登録済み', thumbImage.fileBasePath, thumbImage.type, thumbImage.size, thumbImage.quality);
						break;
					}
					default: {
						throw e;
					}
				}
			}

			thumbImage.type = thumbTypeAlt;

			let thumbFileDataAlt: Buffer | undefined;
			try {
				thumbFileDataAlt = await fs.promises.readFile(thumbImage.fileFullPath);
			} catch (e) {}
			if (thumbFileDataAlt !== undefined) {
				/* 代替画像ファイルが生成済みだった場合は、生成済みの画像データを表示 */
				this.logger.debug(`生成済みの代替画像を表示: ${thumbImage.filePath}`);

				const thumbFileMtime = fs.statSync(thumbImage.fileFullPath).mtime;
				this.#response(req, res, httpResponse, thumbImage.mime, thumbFileDataAlt, thumbFileMtime);
				return;
			}
		}

		/* 画像ファイル生成 */
		const createdFileData = await this.#create(origFileFullPath, thumbImage);

		/* 生成した画像データを表示 */
		this.#response(req, res, httpResponse, thumbImage.mime, createdFileData);
	}

	/**
	 * type パラメーターに指定された値から実際に使用する値を決定する
	 *
	 * @param req - Request
	 *
	 * @returns 実際に使用する type 値
	 */
	#decideType(req: Request): string {
		const requestType = req.query['type'] as string | string[];

		if (typeof requestType === 'string') {
			return requestType;
		}

		/* type パラメーターが複数指定されていた場合、accept リクエストヘッダーと見比べて先頭から順に適用可能な値を抜き出す（適用可能な値が存在しない場合、末尾の値を強制適用する） */
		const acceptType = req.accepts(requestType);

		const type = acceptType !== false ? acceptType : requestType.at(-1)!;
		this.logger.debug('決定 Type', type);

		return type;
	}

	/**
	 * CORS
	 *
	 * @param req - Request
	 * @param res - Response
	 * @param httpResponse - HttpResponse
	 * @param origFileFullPath - オリジナル画像のファイルパス
	 *
	 * @returns サムネイル画像の生成・表示を行う場合は true
	 */
	async #cors(req: Request, res: Response, httpResponse: HttpResponse, origFileFullPath: string): Promise<boolean> {
		const origin = req.get('Origin');
		if (origin !== undefined) {
			/* クロスオリジンからの <img crossorigin> による呼び出し */
			if (!process.env['THUMBIMAGE_ALLOW_ORIGIN']?.split(' ').includes(origin)) {
				this.logger.warn(`許可されていないオリジンからのアクセス: ${origin}`);

				httpResponse.send403();
				return false;
			}

			res.setHeader('Access-Control-Allow-Origin', origin);
			res.vary('Origin');

			return true;
		}

		const fetchMode = req.get('Sec-Fetch-Mode');
		if (fetchMode !== 'cors') {
			/* <a href>, <img> 等による呼び出し */
			this.logger.debug(`Origin ヘッダがなく、Sec-Fetch-Mode: ${String(fetchMode)} なアクセス`);

			res.vary('Origin');
			res.vary('Sec-Fetch-Mode');

			await this.#responseOriginal(req, res, httpResponse, origFileFullPath);
			return false;
		}

		/* 同一オリジンからの <img crossorigin> による呼び出し */
		res.vary('Origin');
		res.vary('Sec-Fetch-Mode');

		return true;
	}

	/**
	 * 出力するファイルの大きさを計算する
	 *
	 * @param requestQuery - URL クエリー情報
	 * @param origFileFullPath - 元画像ファイルのフルパス
	 *
	 * @returns 出力するサムネイル画像ファイルの大きさ
	 */
	#getSize(requestQuery: ThumbImageRequest.Query, origFileFullPath: string): ImageSize | null {
		let origImageWidth: number | undefined;
		let origImageHeight: number | undefined;
		try {
			const dimensions = imageSize(origFileFullPath);
			origImageWidth = dimensions.width;
			origImageHeight = dimensions.height;
		} catch (e) {
			this.logger.warn(e);
			return null;
		}

		if (origImageWidth === undefined || origImageHeight === undefined) {
			return null;
		}

		return ThumbImageUtil.getThumbSize(requestQuery.width, requestQuery.height, { width: origImageWidth, height: origImageHeight });
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

	/**
	 * 画像ファイルを画面に出力する
	 *
	 * @param req - Request
	 * @param res - Response
	 * @param httpResponse - HttpResponse
	 * @param mimeType - MIME タイプ
	 * @param fileData - 画像データ
	 * @param fileMtime - 最終更新日時
	 */
	#response(req: Request, res: Response, httpResponse: HttpResponse, mimeType: string, fileData: Buffer, fileMtime?: Date): void {
		if (fileMtime !== undefined) {
			/* キャッシュ確認 */
			if (httpResponse.checkLastModified(req, fileMtime)) {
				return;
			}
		}

		res.setHeader('Content-Type', mimeType);
		res.setHeader('Cache-Control', configThumbimage.cacheControl);

		res.send(fileData);
	}

	/**
	 * オリジナル画像ファイルを画面に出力する
	 *
	 * @param req - Request
	 * @param res - Response
	 * @param httpResponse - HttpResponse
	 * @param fullPath - オリジナル画像のファイルパス
	 */
	async #responseOriginal(req: Request, res: Response, httpResponse: HttpResponse, fullPath: string): Promise<void> {
		const fileData = await fs.promises.readFile(fullPath);
		const extension = path.extname(fullPath);
		const mimeType = Object.entries(configExpress.static.headers.mime_type.extension)
			.find(([fileExtension]) => fileExtension === extension)
			?.at(1);
		if (mimeType === undefined) {
			this.logger.warn(`MIME タイプが定義されていない画像が指定: ${req.url}`);
			httpResponse.send403();
			return;
		}

		res.setHeader('Content-Type', mimeType);

		res.send(fileData);
	}
}
