import Controller from '../Controller.js';
import ControllerInterface from '../ControllerInterface.js';
import FileSizeFormat from '@saekitominaga/file-size-format';
import fs from 'fs';
import HttpResponse from '../util/HttpResponse.js';
import imageSize from 'image-size';
import path from 'path';
import Sharp from 'sharp';
import { MediaW0SJp as ConfigureCommon } from '../../configure/type/common';
import { NoName as Configure } from '../../configure/type/thumb-image';
import { Request, Response } from 'express';

/**
 * サムネイル画像
 */
export default class ThumbImageController extends Controller implements ControllerInterface {
	#configCommon: ConfigureCommon;
	#config: Configure;

	/* 生成する画像のタイプ（jpeg, webp, ...） */
	#thumbType = '';
	/* 生成する画像の幅 */
	#thumbWidth = 0;
	/* 生成する画像の画質 */
	#thumbQuality = 0;

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
		const requestQuery: ThumbImageRequest.Query = {
			path: req.params.path,
			type: <string>req.query.type ?? null,
			width: <string>req.query.w ?? null,
			max_height: <string>req.query.mh ?? null,
			quality: <string>req.query.quality ?? null,
		};

		const httpResponse = new HttpResponse(res, this.#configCommon);

		/* 存在チェック */
		if (requestQuery.type === null || requestQuery.width === null || requestQuery.quality === null) {
			this.logger.info(`必須 URL パラメーター不足: ${req.url}`);
			httpResponse.send403();
			return;
		}

		/* 型チェック */
		const paramWidthNumber = Number(requestQuery.width);
		const paramMaxheightNumber = requestQuery.max_height !== null ? Number(requestQuery.max_height) : null;
		const paramQualityNumber = Number(requestQuery.quality);
		if (!this._requestUrlParamTypeCheck(req, paramWidthNumber, paramMaxheightNumber, paramQualityNumber)) {
			httpResponse.send403();
			return;
		}

		/* 値チェック */
		if (!this._requestUrlParamValueCheck(req, requestQuery.type, paramWidthNumber, paramMaxheightNumber, paramQualityNumber)) {
			httpResponse.send403();
			return;
		}

		this.#thumbType = requestQuery.type;
		this.#thumbWidth = paramWidthNumber;
		this.#thumbQuality = paramQualityNumber;

		const origFilePath = path.resolve(`${this.#config.orig_dir}/${requestQuery.path}`);
		if (!fs.existsSync(origFilePath)) {
			this.logger.info(`存在しないファイルパスが指定: ${req.url}`);
			httpResponse.send404();
			return;
		}

		const origFileMtime = fs.statSync(origFilePath).mtime;

		if (paramMaxheightNumber !== null) {
			const dimensions = imageSize(origFilePath);
			const origImageWidth = dimensions.width;
			const origImageHeight = dimensions.height;

			if (origImageWidth !== undefined && origImageHeight !== undefined) {
				if ((origImageHeight / origImageWidth) * paramWidthNumber > paramMaxheightNumber) {
					this.#thumbWidth = Math.round((origImageWidth / origImageHeight) * paramMaxheightNumber);
				}
			}
		}

		const parse = path.parse(path.resolve(`${this.#config.thumb_dir}/${requestQuery.path}`));
		const newFilePath = `${parse.dir}/${parse.name}@w=${this.#thumbWidth};q=${this.#thumbQuality}.${this.#config.extension[this.#thumbType]}`;

		if (fs.existsSync(newFilePath)) {
			/* 画像ファイルが生成済みだった場合 */
			const newFileMtime = fs.statSync(newFilePath).mtime;

			if (origFileMtime > newFileMtime) {
				this.logger.debug(`画像が生成済みだが、元画像が更新されているので差し替える: ${req.url}`);
			} else {
				this.logger.debug(`生成済みの画像を表示: ${newFilePath}`);

				/* 生成済みの画像データを表示 */
				this._responseImage(req, res, httpResponse, newFilePath, newFileMtime);
				return;
			}
		} else {
			/* 画像ファイルが生成されていない場合 */
			let create = false; // 画像を生成するか

			const requestHeaderSecFetchDest = req.get('Sec-Fetch-Dest');
			if (requestHeaderSecFetchDest !== undefined) {
				/* Fetch Metadata Request Headers 対応ブラウザ（Chrome 80+）https://caniuse.com/mdn-http_headers_sec-fetch-dest */
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
				/* Fetch Metadata Request Headers 未対応ブラウザ（Firefox, Safari, IE） */
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
				this._responseImage(req, res, httpResponse, origFilePath, origFileMtime); // 元画像を表示
				return;
			}
		}

		/* 新しい画像ファイルを生成する */
		await this._createImage(origFilePath, newFilePath); // 画像ファイルを生成
		this._responseImage(req, res, httpResponse, newFilePath); // 生成した画像データを表示
	}

	/**
	 * URL パラメーターの型をチェックする
	 *
	 * @param {Request} req - Request
	 * @param {number} width - URL パラメーター: width
	 * @param {number | null} maxheight - URL パラメーター: maxheight
	 * @param {number} quality - URL パラメーター: quality
	 *
	 * @returns {boolean} 値に問題があれば false
	 */
	private _requestUrlParamTypeCheck(req: Request, width: number, maxheight: number | null, quality: number): boolean {
		if (Number.isNaN(width)) {
			this.logger.info(`width パラメーターに数値以外の文字列が混入: ${req.url}`);
			return false;
		} else if (!Number.isInteger(width)) {
			this.logger.info(`width パラメーターが整数ではない: ${req.url}`);
			return false;
		}

		if (maxheight !== null) {
			if (Number.isNaN(maxheight)) {
				this.logger.info(`maxheight パラメーターに数値以外の文字列が混入: ${req.url}`);
				return false;
			} else if (!Number.isInteger(maxheight)) {
				this.logger.info(`maxheight パラメーターが整数ではない: ${req.url}`);
				return false;
			}
		}

		if (Number.isNaN(quality)) {
			this.logger.info(`quality パラメーターに数値以外の文字列が混入: ${req.url}`);
			return false;
		} else if (!Number.isInteger(quality)) {
			this.logger.info(`quality パラメーターが整数ではない: ${req.url}`);
			return false;
		}

		return true;
	}

	/**
	 * URL パラメーターの値をチェックする
	 *
	 * @param {Request} req - Request
	 * @param {string} type - URL パラメーター: type
	 * @param {number} width - URL パラメーター: width
	 * @param {number | null} maxheight - URL パラメーター: maxheight
	 * @param {number} quality - URL パラメーター: quality
	 *
	 * @returns {boolean} 値に問題があれば false
	 */
	private _requestUrlParamValueCheck(req: Request, type: string, width: number, maxheight: number | null, quality: number): boolean {
		if (!Object.keys(this.#config.extension).includes(type)) {
			this.logger.info(`type パラメーターの値が定義外: ${req.url}`);
			return false;
		}

		if (width <= 0 || width > this.#config.param.max_width) {
			this.logger.info(`width パラメーターの値が範囲外: ${req.url}`);
			return false;
		}

		if (maxheight !== null && (maxheight <= 0 || maxheight > this.#config.param.max_height)) {
			this.logger.info(`maxheight パラメーターの値が範囲外: ${req.url}`);
			return false;
		}

		if (quality < 0 || quality > 100) {
			this.logger.info(`quality パラメーターの値が範囲外: ${req.url}`);
			return false;
		}

		return true;
	}

	/**
	 * 画像ファイルを生成する
	 *
	 * @param {string} origFilePath - 元画像ファイルパス
	 * @param {string} newFilePath - 生成する画像ファイルパス
	 */
	private async _createImage(origFilePath: string, newFilePath: string): Promise<void> {
		/* ディレクトリのチェック */
		fs.mkdirSync(path.dirname(newFilePath), {
			recursive: true,
		});

		/* 画像ファイル生成 */
		this.logger.debug(`サムネイル画像を新規作成: ${newFilePath}`);

		const startTime = Date.now();

		const sharp = Sharp(origFilePath);
		sharp.resize(this.#thumbWidth);
		switch (this.#thumbType) {
			case 'avif': {
				sharp.avif({
					quality: this.#thumbQuality,
				});
				break;
			}
			case 'webp': {
				sharp.webp({
					quality: this.#thumbQuality,
				});
				break;
			}
			case 'jpeg': {
				sharp.jpeg({
					quality: this.#thumbQuality,
				});
				break;
			}
		}
		await sharp.toFile(newFilePath);

		const processingTime = Date.now() - startTime;

		/* 生成後の処理 */
		const origFileSize = fs.statSync(origFilePath).size;
		const origFileSizeIec = FileSizeFormat.iec(origFileSize, { digits: 1 });
		const createdFileSize = fs.statSync(newFilePath).size;
		const createdFileSizeIec = FileSizeFormat.iec(createdFileSize, { digits: 1 });

		this.logger.info(
			`画像生成完了（${Math.round(processingTime / 1000)}秒）: ${newFilePath} （幅: ${this.#thumbWidth}px, 画質: ${
				this.#thumbQuality
			}, サイズ: ${createdFileSizeIec}, 元画像サイズ: ${origFileSizeIec}）`
		);

		/* 管理者向け通知 */
		if (createdFileSize >= origFileSize * 10 && createdFileSize > 10240) {
			this.logger.warn(
				`元画像よりファイルサイズの大きな画像が生成: ${newFilePath} （幅: ${this.#thumbWidth}px, 画質: ${
					this.#thumbQuality
				}, サイズ: ${createdFileSizeIec}, 元画像サイズ: ${origFileSizeIec}）`
			);
		}
	}

	/**
	 * 画像ファイルを画面に出力する
	 *
	 * @param {Request} req - Request
	 * @param {Response} res - Response
	 * @param {HttpResponse} httpResponse - HttpResponse
	 * @param {string} filePath - 出力する画像ファイルパス
	 * @param {Date} fileMtime - 最終更新日時
	 */
	private _responseImage(req: Request, res: Response, httpResponse: HttpResponse, filePath: string, fileMtime?: Date): void {
		if (fileMtime !== undefined) {
			/* キャッシュ確認 */
			if (httpResponse.checkLastModified(req, fileMtime)) {
				return;
			}
		}

		res.sendFile(filePath, {
			maxAge: this.#configCommon.static.options.max_age,
		});
	}
}
