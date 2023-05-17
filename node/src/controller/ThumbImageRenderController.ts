import fs from 'node:fs';
import path from 'node:path';
import FileSizeFormat from '@saekitominaga/file-size-format';
import { imageSize } from 'image-size';
import { Request, Response } from 'express';
import Controller from '../Controller.js';
import ControllerInterface from '../ControllerInterface.js';
import HttpResponse from '../util/HttpResponse.js';
import ThumbImage from '../util/ThumbImage.js';
import ThumbImageRenderDao from '../dao/ThumbImageRenderDao.js';
import ThumbImageValidator from '../validator/ThumbImageValidator.js';
import ThumbImageUtil from '../util/ThumbImageUtil.js';
import { MediaW0SJp as ConfigureCommon } from '../../configure/type/common.js';
import { NoName as Configure } from '../../configure/type/thumb-image.js';

/**
 * サムネイル画像表示
 */
export default class ThumbImageRenderController extends Controller implements ControllerInterface {
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
		const httpResponse = new HttpResponse(res, this.#configCommon);

		const validationResult = await new ThumbImageValidator(req, this.#config).render();
		if (!validationResult.isEmpty()) {
			this.logger.info('パラメーター不正', validationResult.array());
			httpResponse.send403();
			return;
		}

		let type: ImageType;
		if (typeof req.query['type'] === 'string') {
			type = <ImageType>req.query['type'];
		} else {
			/* type パラメーターが複数指定されていた場合、 accept リクエストヘッダーと見比べて先頭から順に適用可能な値を抜き出す（適用可能な値が存在しない場合、末尾の値を強制適用する） */
			const types = <ImageType[]>req.query['type'];
			const acceptType = req.accepts(types);
			type = acceptType !== false ? <ImageType>acceptType : <ImageType>types.at(-1);
			this.logger.debug('決定 Type', type);
		}

		const requestQuery: ThumbImageRequest.Query = {
			path: req.params['path'] ?? '', // TS エラー防止のためデフォルト値を設定しているが、 app.js 内の処理により path パラメーターは必ず存在する想定
			type: type,
			width: req.query['w'] !== undefined ? Number(req.query['w']) : null,
			height: req.query['h'] !== undefined ? Number(req.query['h']) : null,
			quality: req.query['quality'] !== undefined ? Number(req.query['quality']) : this.#config.quality_default,
		};

		const origFileFullPath = path.resolve(`${this.#configCommon.static.root}/${this.#configCommon.static.directory.image}/${requestQuery.path}`);
		if (!fs.existsSync(origFileFullPath)) {
			this.logger.info(`存在しないファイルパスが指定: ${req.url}`);
			httpResponse.send404();
			return;
		}

		const thumbSize = this.getSize(requestQuery, origFileFullPath);
		if (thumbSize === null) {
			this.logger.info(`サイズが取得できない画像が指定: ${req.url}`);
			httpResponse.send403();
			return;
		}

		const origFileMtime = (await fs.promises.stat(origFileFullPath)).mtime;

		const thumbImage = new ThumbImage(this.#config.type, this.#config.thumb_dir, requestQuery.path, requestQuery.type, thumbSize, requestQuery.quality);

		let thumbFileData: Buffer | undefined;
		try {
			thumbFileData = await fs.promises.readFile(thumbImage.fileFullPath);
		} catch (e) {}
		if (thumbFileData !== undefined) {
			/* 画像ファイルが生成済みだった場合 */
			const thumbFileMtime = fs.statSync(thumbImage.fileFullPath).mtime;

			if (origFileMtime > thumbFileMtime) {
				/* 元画像が更新されている場合 */
				this.logger.info(`画像が生成済みだが、元画像が更新されているので差し替える: ${req.url}`);
			} else {
				/* 生成済みの画像データを表示 */
				this.logger.debug(`生成済みの画像を表示: ${thumbImage.filePath}`);

				this.response(req, res, httpResponse, thumbImage.mime, thumbFileData, thumbFileMtime);
				return;
			}
		} else if (!this.judgeCreate(req, res, requestQuery)) {
			/* 画像ファイルが生成されていない場合（元画像を表示する） */
			const origFileData = await fs.promises.readFile(origFileFullPath);
			const origFileExtension = path.extname(origFileFullPath);
			const origFileMime = Object.entries(this.#configCommon.static.headers.mime.extension).find(([, extensions]) =>
				extensions.includes(origFileExtension.substring(1))
			)?.[0];
			if (origFileMime === undefined) {
				this.logger.info(`MIME が定義されていない画像が指定: ${req.url}`);
				httpResponse.send403();
				return;
			}

			this.response(req, res, httpResponse, origFileMime, origFileData, origFileMtime);
			return;
		}

		const thumbTypeAlt = thumbImage.altType;
		if (thumbTypeAlt !== undefined) {
			/* 代替タイプが設定されている場合はリアルタイム生成を行わず、ファイル生成情報を DB に登録する（別途、バッチ処理でファイル生成を行うため） */
			const dao = new ThumbImageRenderDao(this.#configCommon);
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
					case this.#configCommon.sqlite.errno['locked']: {
						this.logger.warn('DB ロック', thumbImage.fileBasePath, thumbImage.type, thumbImage.size, thumbImage.quality);
						break;
					}
					case this.#configCommon.sqlite.errno['unique_constraint']: {
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
				this.response(req, res, httpResponse, thumbImage.mime, thumbFileDataAlt, thumbFileMtime);
				return;
			}
		}

		/* 画像ファイル生成 */
		const createdFileData = await this.create(origFileFullPath, thumbImage);

		/* 生成した画像データを表示 */
		this.response(req, res, httpResponse, thumbImage.mime, createdFileData);
	}

	/**
	 * 出力するファイルの大きさを計算する
	 *
	 * @param {object} requestQuery - URL クエリー情報
	 * @param {string} origFileFullPath - 元画像ファイルのフルパス
	 *
	 * @returns {object} 出力するサムネイル画像ファイルの大きさ
	 */
	private getSize(requestQuery: ThumbImageRequest.Query, origFileFullPath: string): ImageSize | null {
		let origImageWidth: number | undefined;
		let origImageHeight: number | undefined;
		try {
			const dimensions = imageSize(origFileFullPath);
			origImageWidth = dimensions.width;
			origImageHeight = dimensions.height;
		} catch (e) {
			this.logger.info(e);
			return null;
		}

		if (origImageWidth === undefined || origImageHeight === undefined) {
			return null;
		}

		return ThumbImageUtil.getThumbSize(requestQuery.width, requestQuery.height, { width: origImageWidth, height: origImageHeight });
	}

	/**
	 * サムネイル画像を新規生成するかどうか判定する
	 *
	 * @param {Request} req - Request
	 * @param {Response} res - Response
	 * @param {object} requestQuery - URL クエリー情報
	 *
	 * @returns {boolean} 新規生成する場合は true
	 */
	private judgeCreate(req: Request, res: Response, requestQuery: ThumbImageRequest.Query): boolean {
		const requestHeaderSecFetchDest = req.get('Sec-Fetch-Dest');
		if (requestHeaderSecFetchDest !== undefined) {
			/* Fetch Metadata Request Headers 対応ブラウザ（Firefox 90+, Chrome 80+）https://caniuse.com/mdn-http_headers_sec-fetch-dest */
			switch (req.get('Sec-Fetch-Site')) {
				case 'same-origin':
				case 'same-site': {
					/* 自サイト内の埋め込みやリンク遷移時は新規画像生成を行う */
					return true;
				}
				case 'none': {
					this.logger.debug(`画像が URL 直打ち等でリクエストされたので元画像を表示: ${req.url}`);

					res.append('Vary', 'Sec-Fetch-Site');
					break;
				}
				default: {
					/* Sec-Fetch-Site: cross-site */
					const referrer = req.headers.referer;
					if (referrer === undefined) {
						this.logger.debug(`リファラーが送出されていないので元画像を表示: ${req.url}`);

						res.append('Vary', 'Sec-Fetch-Site');
					} else {
						const referrerUrl = new URL(referrer);
						const referrerOrigin = referrerUrl.origin;

						if (this.#config.allow_origins.includes(referrerOrigin)) {
							/* 開発環境からのアクセスの場合 */
							return true;
						}

						this.logger.debug(`別サイトから '${requestHeaderSecFetchDest}' でリクエストされたので元画像を表示: ${req.url}`);

						res.append('Vary', 'Sec-Fetch-Site');

						if (['image', 'iframe', 'object', 'embed'].includes(requestHeaderSecFetchDest)) {
							if (!this.#config.referrer_exclusion_origins.includes(referrerOrigin)) {
								this.logger.warn(
									`画像ファイル ${requestQuery.path} が別オリジンから埋め込まれている（リファラー: ${referrer} 、DEST: ${requestHeaderSecFetchDest} ）`
								);
							}
						}
					}
				}
			}
		} else {
			/* Fetch Metadata Request Headers 未対応ブラウザ（Safari, IE） */
			const referrer = req.headers.referer;
			if (referrer === undefined) {
				this.logger.debug(`リファラーが送出されていないので元画像を表示: ${req.url}`);

				res.append('Vary', 'referer');
			} else {
				const referrerUrl = new URL(referrer);
				const referrerOrigin = referrerUrl.origin;

				if (this.#config.allow_origins.includes(referrerOrigin)) {
					/* 同一オリジンのリファラーがある、ないし開発環境からのアクセスの場合 */
					if (req.url !== `${referrerUrl.pathname}${referrerUrl.search}`) {
						return true;
					}

					this.logger.debug(`リファラーが画像ファイル自身なので元画像を表示: ${req.url}`);

					res.append('Vary', 'referer');
				} else {
					this.logger.debug(`別ドメインからリンクないし埋め込まれているので元画像を表示: ${req.url}`);

					res.append('Vary', 'referer');

					if (!this.#config.referrer_exclusion_origins.includes(referrerOrigin)) {
						this.logger.warn(`画像ファイル ${requestQuery.path} が別オリジンから埋め込まれている（リファラー: ${referrer} ）`);
					}
				}
			}
		}

		return false;
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
		const origFileSize = FileSizeFormat.iec((await fs.promises.stat(origFileFullPath)).size, { digits: 1 });
		const createdFileSize = FileSizeFormat.iec(createdFileData.byteLength, { digits: 1 });

		this.logger.info(`画像生成完了（${Math.round(createProcessingTime / 1000)}秒）: ${thumbImage.filePath} （${origFileSize} → ${createdFileSize}）`);

		return createdFileData;
	}

	/**
	 * 画像ファイルを画面に出力する
	 *
	 * @param {Request} req - Request
	 * @param {Response} res - Response
	 * @param {HttpResponse} httpResponse - HttpResponse
	 * @param {string} mime - MIME
	 * @param {object} fileData - 画像データ
	 * @param {Date} fileMtime - 最終更新日時
	 */
	private response(req: Request, res: Response, httpResponse: HttpResponse, mime: string, fileData: Buffer, fileMtime?: Date): void {
		if (fileMtime !== undefined) {
			/* キャッシュ確認 */
			if (httpResponse.checkLastModified(req, fileMtime)) {
				return;
			}
		}

		res.setHeader('Content-Type', mime);
		res.setHeader('Cache-Control', this.#config.cache_control);

		res.send(fileData);
	}
}
