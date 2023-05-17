import path from 'node:path';
import { NoName2 as ImageInfo } from '../../configure/type/thumb-image.js';

/**
 * サムネイル画像
 */
export default class ThumbImage {
	/* ファイルタイプ毎の MIME タイプや拡張子の定義 */
	#imageInfo: ImageInfo;

	/* サムネイル画像を保存するルートディレクトリ */
	#dir: string;

	/* ベースとなるファイルパス */
	#fileBasePath: string;

	/* 画像タイプ */
	#type: ImageType;

	/* 画像の大きさ */
	#size: ImageSize;

	/* 画像品質 */
	#quality: number | undefined;

	/**
	 * @param {ImageInfo} imageInfo - ファイルタイプ毎の MIME タイプや拡張子の定義
	 * @param {string} dir - サムネイル画像を保存するルートディレクトリ
	 * @param {string} fileBasePath - ベースとなるファイルパス
	 * @param {object} type - 画像タイプ
	 * @param {object} size - 画像サイズ
	 * @param {number} quality - 画像品質
	 */
	constructor(imageInfo: ImageInfo, dir: string, fileBasePath: string, type: ImageType, size: ImageSize, quality?: number) {
		this.#imageInfo = imageInfo;
		this.#dir = dir;
		this.#fileBasePath = fileBasePath;

		this.#type = type;
		this.#size = size;
		this.#quality = quality;
	}

	/**
	 * 画像定義を取得する
	 *
	 * @returns {object} MIME タイプや拡張子の定義
	 */
	#getImageInfo() {
		const imageInfo = this.#imageInfo[this.#type];
		if (imageInfo === undefined) {
			throw new Error('Specified image type information is not registered.');
		}

		return imageInfo;
	}

	get fileBasePath(): string {
		return this.#fileBasePath;
	}

	get filePath(): string {
		const imageInfo = this.#getImageInfo();

		const paramSize = `s=${this.#size.width}x${this.#size.height}`;
		const paramQuality = `q=${this.#quality}`;

		const params = imageInfo.quality ? [paramSize, paramQuality] : [paramSize];

		return `${this.#fileBasePath}@${params.join(';')}.${imageInfo.extension}`; // e.g `path/to.jpg@s=100x200;q=80.webp`
	}

	get fileFullPath(): string {
		return path.resolve(`${this.#dir}/${this.filePath}`);
	}

	get mime(): string {
		return this.#getImageInfo().mime;
	}

	get altType(): ImageType | undefined {
		return this.#getImageInfo().alt_type;
	}

	get type(): ImageType {
		return this.#type;
	}

	set type(type: ImageType) {
		this.#type = type;
	}

	get size(): ImageSize {
		return this.#size;
	}

	set size(size: ImageSize) {
		this.#size = size;
	}

	get quality(): number | undefined {
		return this.#quality;
	}

	set quality(quality: number | undefined) {
		this.#quality = quality;
	}
}
