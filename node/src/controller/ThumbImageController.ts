import Controller from '../Controller.js';
import ControllerInterface from '../ControllerInterface.js';
import FileSizeFormat from '@saekitominaga/file-size-format';
import fs from 'fs';
import HttpResponse from '../util/HttpResponse.js';
import imageSize from 'image-size';
import path from 'path';
import Sharp from 'sharp';
import ThumbImageValidator from '../validator/ThumbImageValidator.js';
import { MediaW0SJp as ConfigureCommon } from '../../configure/type/common';
import { NoName as Configure } from '../../configure/type/thumb-image';
import { Request, Response } from 'express';

type ImageSize = {
	width: number;
	height: number;
};

/**
 * サムネイル画像
 */
export default class ThumbImageController extends Controller implements ControllerInterface {
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
		const requestQuery: ThumbImageRequest.Query = {
			path: req.params.path,
			type: <string>req.query.type,
			width: req.query.w !== undefined ? Number(req.query.w) : null,
			height: req.query.h !== undefined ? Number(req.query.h) : null,
			quality: req.query.quality !== undefined ? Number(req.query.quality) : this.#config.quality_default,
		};

		const validationResult = await new ThumbImageValidator(req, this.#config).display();

		const httpResponse = new HttpResponse(res, this.#configCommon);

		if (!validationResult.isEmpty()) {
			this.logger.info('パラメーター不正', validationResult.array());
			httpResponse.send403();
			return;
		}

		const origFilePath = path.resolve(`${this.#config.orig_dir}/${requestQuery.path}`);
		if (!fs.existsSync(origFilePath)) {
			this.logger.info(`存在しないファイルパスが指定: ${req.url}`);
			httpResponse.send404();
			return;
		}

		const origFileMtime = fs.statSync(origFilePath).mtime;

		/* 出力するファイルのサイズを計算する */
		const newImageSize = this.getNewFileSize(requestQuery, origFilePath);
		if (newImageSize === null) {
			this.logger.info(`存在しないファイルパスが指定: ${req.url}`);
			httpResponse.send403();
			return;
		}

		/* 出力するファイルパス */
		const newFilePath = this.getNewFilePath(requestQuery, newImageSize);

		if (fs.existsSync(newFilePath)) {
			/* 画像ファイルが生成済みだった場合 */
			const newFileMtime = fs.statSync(newFilePath).mtime;

			if (origFileMtime > newFileMtime) {
				this.logger.debug(`画像が生成済みだが、元画像が更新されているので差し替える: ${req.url}`);
			} else {
				this.logger.debug(`生成済みの画像を表示: ${newFilePath}`);

				/* 生成済みの画像データを表示 */
				this.responseImage(req, res, httpResponse, newFilePath, newFileMtime);
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
				this.responseImage(req, res, httpResponse, origFilePath, origFileMtime); // 元画像を表示
				return;
			}
		}

		/* 新しい画像ファイルを生成する */
		await this.createImage(requestQuery, origFilePath, newFilePath, newImageSize); // 画像ファイルを生成
		this.responseImage(req, res, httpResponse, newFilePath); // 生成した画像データを表示
	}

	/**
	 * 出力する画像ファイルの大きさを計算する
	 *
	 * @param {object} requestQuery - URL クエリー情報
	 * @param {string} origFilePath - オリジナル画像のパス
	 *
	 * @returns {object} 出力する画像ファイルの大きさ
	 */
	private getNewFileSize(requestQuery: ThumbImageRequest.Query, origFilePath: string): ImageSize | null {
		const dimensions = imageSize(origFilePath);
		const origImageWidth = dimensions.width;
		const origImageHeight = dimensions.height;

		if (origImageWidth === undefined || origImageHeight === undefined) {
			return null;
		}
		this.logger.debug('オリジナル画像サイズ', `${origImageWidth}x${origImageHeight}`);

		let newImageWidth = origImageWidth;
		let newImageHeight = origImageHeight;

		if (requestQuery.height === null) {
			/* 幅のみが指定された場合 */
			if (requestQuery.width !== null && requestQuery.width < origImageWidth) {
				/* 幅を基準に縮小する */
				newImageWidth = requestQuery.width;
				newImageHeight = Math.round((origImageHeight / origImageWidth) * requestQuery.width);

				this.logger.debug('幅のみが指定された場合', `${newImageWidth}x${newImageHeight}`);
			}
		} else if (requestQuery.width === null) {
			/* 高さのみが指定された場合 */
			if (requestQuery.height !== null && requestQuery.height < origImageHeight) {
				/* 高さを基準に縮小する */
				newImageWidth = Math.round((origImageWidth / origImageHeight) * requestQuery.height);
				newImageHeight = requestQuery.height;

				this.logger.debug('高さのみが指定された場合', `${newImageWidth}x${newImageHeight}`);
			}
		} else {
			/* 幅、高さが両方指定された場合 */
			if (requestQuery.width !== null && requestQuery.height !== null && (requestQuery.width < origImageWidth || requestQuery.height < origImageHeight)) {
				/* 幅か高さ、どちらかより縮小割合が大きい方を基準に縮小する */
				const reductionRatio = Math.min(requestQuery.width / origImageWidth, requestQuery.height / origImageHeight);

				newImageWidth = Math.round(origImageWidth * reductionRatio);
				newImageHeight = Math.round(origImageHeight * reductionRatio);

				this.logger.debug('幅、高さが両方指定された場合', `${newImageWidth}x${newImageHeight}`);
			}
		}

		return { width: newImageWidth, height: newImageHeight };
	}

	/**
	 * 出力する画像ファイルパスを組み立てる
	 *
	 * @param {object} requestQuery - URL クエリー情報
	 * @param {ImageSize} imageSize - 出力画像の大きさ
	 *
	 * @returns {string} 出力する画像ファイルパス
	 */
	private getNewFilePath(requestQuery: ThumbImageRequest.Query, imageSize: ImageSize): string {
		const parse = path.parse(path.resolve(`${this.#config.thumb_dir}/${requestQuery.path}`));

		const paramSize = `s=${imageSize.width}x${imageSize.height}`;
		const paramQuality = `q=${requestQuery.quality}`;

		const params = [paramSize];
		if (requestQuery.type !== 'png') {
			params.push(paramQuality);
		}

		return `${parse.dir}/${parse.base}@${params.join(';')}.${this.#config.extension[requestQuery.type]}`;
	}

	/**
	 * 画像ファイルを生成する
	 *
	 * @param {object} requestQuery - URL クエリー情報
	 * @param {string} origFilePath - 元画像ファイルパス
	 * @param {string} newFilePath - 生成する画像ファイルパス
	 * @param {ImageSize} newImageSize - 生成する画像ファイルのサイズ
	 */
	private async createImage(requestQuery: ThumbImageRequest.Query, origFilePath: string, newFilePath: string, newImageSize: ImageSize): Promise<void> {
		/* ディレクトリのチェック */
		fs.mkdirSync(path.dirname(newFilePath), {
			recursive: true,
		});

		/* 画像ファイル生成 */
		this.logger.debug(`サムネイル画像を新規作成: ${newFilePath}`);

		const startTime = Date.now();

		/* sharp 設定 */
		Sharp.cache(false);

		const sharp = Sharp(origFilePath);
		sharp.resize(newImageSize.width, newImageSize.height);
		switch (requestQuery.type) {
			case 'avif': {
				sharp.avif({
					quality: requestQuery.quality,
				});
				break;
			}
			case 'webp': {
				sharp.webp({
					quality: requestQuery.quality,
				});
				break;
			}
			case 'jpeg': {
				sharp.jpeg({
					quality: requestQuery.quality,
				});
				break;
			}
			case 'png': {
				const sharpOptions: Sharp.PngOptions = {
					compressionLevel: 9,
				};

				const metadata = await sharp.metadata();
				// @ts-expect-error: ts(2339)
				if (metadata.format === 'png' && metadata.paletteBitDepth === 8) {
					/* PNG8 */
					sharpOptions.palette = true;
				}

				sharp.png(sharpOptions);

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
			`画像生成完了（${Math.round(processingTime / 1000)}秒）: ${newFilePath} （幅: ${requestQuery.width}px, 画質: ${
				requestQuery.quality
			}, サイズ: ${createdFileSizeIec}, 元画像サイズ: ${origFileSizeIec}）`
		);

		/* 管理者向け通知 */
		if (createdFileSize >= origFileSize * 10 && createdFileSize > 10240) {
			this.logger.warn(
				`元画像よりファイルサイズの大きな画像が生成: ${newFilePath} （幅: ${requestQuery.width}px, 画質: ${requestQuery.quality}, サイズ: ${createdFileSizeIec}, 元画像サイズ: ${origFileSizeIec}）`
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
	private responseImage(req: Request, res: Response, httpResponse: HttpResponse, filePath: string, fileMtime?: Date): void {
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
