import Controller from '../Controller.js';
import ControllerInterface from '../ControllerInterface.js';
import fs from 'fs';
import HttpResponse from '../util/HttpResponse.js';
import path from 'path';
import ThumbImageValidator from '../validator/ThumbImageValidator.js';
import { MediaW0SJp as ConfigureCommon } from '../../configure/type/common';
import { NoName as Configure } from '../../configure/type/thumb-image';
import { Request, Response } from 'express';
import imageSize from 'image-size';
import ThumbImage from '../util/ThumbImage.js';
import ThumbImageRenderDao from '../dao/ThumbImageRenderDao.js';
import FileSizeFormat from '@saekitominaga/file-size-format';

/**
 * サムネイル画像の画面表示
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

		const validationResult = await new ThumbImageValidator(req, this.#config).display();
		if (!validationResult.isEmpty()) {
			this.logger.info('パラメーター不正', validationResult.array());
			httpResponse.send403();
			return;
		}

		let type: string;
		if (typeof req.query.type === 'string') {
			type = req.query.type;
		} else {
			/* type パラメーターが複数指定されていた場合、 accept リクエストヘッダーと見比べて先頭から順に適用可能な値を抜き出す（適用可能な値が存在しない場合、末尾の値を強制適用する） */
			const types = <string[]>req.query.type;
			const acceptType = req.accepts(types);
			type = acceptType !== false ? acceptType : types[types.length - 1];
			this.logger.debug('決定 Type', type);
		}

		const requestQuery: ThumbImageRequest.Query = {
			path: req.params.path,
			type: type,
			width: req.query.w !== undefined ? Number(req.query.w) : null,
			height: req.query.h !== undefined ? Number(req.query.h) : null,
			quality: req.query.quality !== undefined ? Number(req.query.quality) : this.#config.quality_default,
		};

		const origFilePath = path.resolve(`${this.#configCommon.static.root}/${this.#configCommon.static.directory.image}/${requestQuery.path}`);
		if (!fs.existsSync(origFilePath)) {
			this.logger.info(`存在しないファイルパスが指定: ${req.url}`);
			httpResponse.send404();
			return;
		}

		const origFileMtime = fs.statSync(origFilePath).mtime;

		/* 出力するファイルのサイズを計算する */
		const dimensions = imageSize(origFilePath);
		const origImageWidth = dimensions.width;
		const origImageHeight = dimensions.height;

		if (origImageWidth === undefined || origImageHeight === undefined) {
			this.logger.info(`存在しないファイルパスが指定: ${req.url}`);
			httpResponse.send403();
			return;
		}

		const thumbImageSize = ThumbImage.getThumbSize(requestQuery.width, requestQuery.height, { width: origImageWidth, height: origImageHeight });

		/* 出力するファイルパス */
		const thumbFileName = ThumbImage.getThumbFileName(requestQuery.path, requestQuery.type, requestQuery.quality, thumbImageSize, this.#config.type);
		const thumbFilePath = path.resolve(`${this.#config.thumb_dir}/${thumbFileName}`);

		let thumbFileData: Buffer | undefined;
		try {
			thumbFileData = await fs.promises.readFile(thumbFilePath);
		} catch (e) {}
		if (thumbFileData !== undefined) {
			/* 画像ファイルが生成済みだった場合 */
			const thumbFileMtime = fs.statSync(thumbFilePath).mtime;

			if (origFileMtime > thumbFileMtime) {
				this.logger.debug(`画像が生成済みだが、元画像が更新されているので差し替える: ${req.url}`);
			} else {
				this.logger.debug(`生成済みの画像を表示: ${thumbFileName}`);

				/* 生成済みの画像データを表示 */
				this.responseImage(req, res, requestQuery, httpResponse, thumbFileData, thumbFileMtime);
				return;
			}
		} else {
			/* 画像ファイルが生成されていない場合 */
			let create = false; // 画像を生成するか

			const requestHeaderSecFetchDest = req.get('Sec-Fetch-Dest');
			if (requestHeaderSecFetchDest !== undefined) {
				/* Fetch Metadata Request Headers 対応ブラウザ（Firefox 90+, Chrome 80+）https://caniuse.com/mdn-http_headers_sec-fetch-dest */
				switch (req.get('Sec-Fetch-Site')) {
					case 'same-origin':
					case 'same-site': {
						/* 自サイト内の埋め込みやリンク遷移時は新規画像生成を行う */
						create = true;
						break;
					}
					case 'none': {
						this.logger.debug(`画像が URL 直打ち等でリクエストされたので元画像を表示: ${req.url}`);

						res.append('Vary', 'Sec-Fetch-Site');
						break;
					}
					default: {
						/* Sec-Fetch-Site: cross-site */
						const referrerStr = req.headers.referer;
						if (referrerStr === undefined) {
							this.logger.debug(`リファラーが送出されていないので元画像を表示: ${req.url}`);

							res.append('Vary', 'Sec-Fetch-Site');
						} else {
							const referrer = new URL(referrerStr);
							const referrerOrigin = referrer.origin;

							if (this.#config.allow_origins.includes(referrerOrigin)) {
								/* 開発環境からのアクセスの場合 */
								create = true;
							} else {
								this.logger.debug(`別サイトから '${requestHeaderSecFetchDest}' でリクエストされたので元画像を表示: ${req.url}`);

								res.append('Vary', 'Sec-Fetch-Site');

								if (['image', 'iframe', 'object', 'embed'].includes(requestHeaderSecFetchDest)) {
									if (!this.#config.referrer_exclusion_origins.includes(referrerOrigin)) {
										this.logger.warn(
											`画像ファイル ${requestQuery.path} が別オリジンから埋め込まれている（リファラー: ${referrerStr} 、DEST: ${requestHeaderSecFetchDest} ）`
										);
									}
								}
							}
						}
					}
				}
			} else {
				/* Fetch Metadata Request Headers 未対応ブラウザ（Safari, IE） */
				const referrerStr = req.headers.referer;
				if (referrerStr === undefined) {
					this.logger.debug(`リファラーが送出されていないので元画像を表示: ${req.url}`);

					res.append('Vary', 'referer');
				} else {
					const referrer = new URL(referrerStr);
					const referrerOrigin = referrer.origin;

					if (this.#config.allow_origins.includes(referrerOrigin)) {
						/* 同一オリジンのリファラーがある、ないし開発環境からのアクセスの場合 */
						if (req.url !== `${referrer.pathname}${referrer.search}`) {
							create = true;
						} else {
							this.logger.debug(`リファラーが画像ファイル自身なので元画像を表示: ${req.url}`);

							res.append('Vary', 'referer');
						}
					} else {
						this.logger.debug(`別ドメインからリンクないし埋め込まれているので元画像を表示: ${req.url}`);

						res.append('Vary', 'referer');

						if (!this.#config.referrer_exclusion_origins.includes(referrerOrigin)) {
							this.logger.warn(`画像ファイル ${requestQuery.path} が別オリジンから埋め込まれている（リファラー: ${referrerStr} ）`);
						}
					}
				}
			}

			if (!create) {
				/* 元画像を表示する */
				const origFileData = await fs.promises.readFile(origFilePath);
				this.responseImage(req, res, requestQuery, httpResponse, origFileData, origFileMtime); // 元画像を表示
				return;
			}
		}

		/* 新しい画像ファイルを生成 */
		const createStartTime = Date.now();
		const createdFileData = await ThumbImage.createImage(origFilePath, {
			path: thumbFilePath,
			type: requestQuery.type,
			width: thumbImageSize.width,
			height: thumbImageSize.height,
			quality: requestQuery.quality,
		});
		const createProcessingTime = Date.now() - createStartTime;

		/* 生成した画像データを表示 */
		this.responseImage(req, res, requestQuery, httpResponse, createdFileData);

		/* 生成後の処理 */
		const origFileSize = fs.statSync(origFilePath).size;
		const origFileSizeIec = FileSizeFormat.iec(origFileSize, { digits: 1 });
		const createdFileSize = fs.statSync(thumbFilePath).size;
		const createdFileSizeIec = FileSizeFormat.iec(createdFileSize, { digits: 1 });

		this.logger.info(`画像生成完了（${Math.round(createProcessingTime / 1000)}秒）: ${thumbFileName} （${origFileSizeIec} → ${createdFileSizeIec}）`);

		/* DB に登録 */
		switch (requestQuery.type) {
			case 'avif': {
				const dao = new ThumbImageRenderDao(this.#configCommon);
				try {
					const insertedCount = await dao.insert(requestQuery.path, requestQuery.type, thumbImageSize.width, thumbImageSize.height, requestQuery.quality);
					if (insertedCount > 0) {
						this.logger.info(`ファイル生成情報を DB に登録: ${requestQuery.path}`);
					}
				} catch (e) {
					if (!(e instanceof Error)) {
						throw e;
					}

					// @ts-expect-error: ts(2339)
					switch (e.errno) {
						case this.#configCommon.sqlite.errno.unique_constraint: {
							this.logger.info(`ファイル生成情報は DB 登録済み: ${requestQuery.path}`);
							break;
						}
						default: {
							throw e;
						}
					}
				}

				break;
			}
		}
	}

	/**
	 * 画像ファイルを画面に出力する
	 *
	 * @param {Request} req - Request
	 * @param {Response} res - Response
	 * @param {object} requestQuery - URL クエリー情報
	 * @param {HttpResponse} httpResponse - HttpResponse
	 * @param {object} fileData - 出力する画像データ
	 * @param {Date} fileMtime - 最終更新日時
	 */
	private responseImage(
		req: Request,
		res: Response,
		requestQuery: ThumbImageRequest.Query,
		httpResponse: HttpResponse,
		fileData: Buffer,
		fileMtime?: Date
	): void {
		if (fileMtime !== undefined) {
			/* キャッシュ確認 */
			if (httpResponse.checkLastModified(req, fileMtime)) {
				return;
			}
		}

		res.setHeader('Content-Type', this.#config.type[requestQuery.type].mime);
		res.setHeader('Cache-Control', this.#config.cache_control);
		res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

		res.send(fileData);
	}
}
