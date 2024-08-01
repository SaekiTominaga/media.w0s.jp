import fs from 'node:fs';
import path from 'node:path';
import Sharp from 'sharp';
import ThumbImage from './ThumbImage.js';

/**
 * サムネイル画像のユーティリティー
 */
export default class ThumbImageUtil {
	/**
	 * 出力するサムネイル画像ファイルの大きさを計算する
	 *
	 * @param requestWidth - リクエストされた幅
	 * @param requestHeight - リクエストされた高さ
	 * @param origImage - オリジナル画像のサイズ情報
	 *
	 * @returns 出力するサムネイル画像ファイルの大きさ
	 */
	static getThumbSize(requestWidth: number | null, requestHeight: number | null, origImage: ImageSize): ImageSize {
		let newImageWidth = origImage.width;
		let newImageHeight = origImage.height;

		if (requestHeight === null) {
			/* 幅のみが指定された場合 */
			if (requestWidth !== null && requestWidth < origImage.width) {
				/* 幅を基準に縮小する */
				newImageWidth = requestWidth;
				newImageHeight = Math.round((origImage.height / origImage.width) * requestWidth);
			}
		} else if (requestWidth === null) {
			/* 高さのみが指定された場合 */
			if (requestHeight < origImage.height) {
				/* 高さを基準に縮小する */
				newImageWidth = Math.round((origImage.width / origImage.height) * requestHeight);
				newImageHeight = requestHeight;
			}
		} else if (requestWidth < origImage.width || requestHeight < origImage.height) {
			/* 幅、高さが両方指定された場合（幅か高さ、どちらかより縮小割合が大きい方を基準に縮小する） */
			const reductionRatio = Math.min(requestWidth / origImage.width, requestHeight / origImage.height);

			newImageWidth = Math.round(origImage.width * reductionRatio);
			newImageHeight = Math.round(origImage.height * reductionRatio);
		}

		return { width: newImageWidth, height: newImageHeight };
	}

	/**
	 * 画像ファイルを生成する
	 *
	 * @param origFilePath - 元画像ファイルのフルパス
	 * @param thumbImage - 生成するサムネイル画像のファイル情報
	 *
	 * @returns 生成したサムネイル画像データ
	 */
	static async createImage(origFilePath: string, thumbImage: ThumbImage): Promise<Buffer> {
		/* ディレクトリのチェック */
		const thumbDirectory = path.dirname(thumbImage.fileFullPath);
		if (!fs.existsSync(thumbDirectory)) {
			await fs.promises.mkdir(thumbDirectory, {
				recursive: true,
			});
		}

		/* sharp 設定 */
		Sharp.cache(false);

		// eslint-disable-next-line new-cap
		const sharp = Sharp(origFilePath);
		sharp.resize(thumbImage.size.width, thumbImage.size.height);
		switch (thumbImage.type) {
			case 'avif': {
				sharp.avif({
					quality: thumbImage.quality,
				});
				break;
			}
			case 'webp': {
				sharp.webp({
					quality: thumbImage.quality,
				});
				break;
			}
			case 'jpeg': {
				sharp.jpeg({
					quality: thumbImage.quality,
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
			default:
		}

		const fileData = await sharp.toBuffer();
		await fs.promises.writeFile(thumbImage.fileFullPath, fileData);

		return fileData;
	}
}
