import path from 'path';
import { NoName2 as ImageInfos } from '../../configure/type/thumb-image.js';

/**
 * サムネイル画像
 */
export default class ThumbImage {
	/* ファイルタイプ毎の MIME タイプや拡張子の定義 */
	#imageInfo;

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
	 * @param {ImageInfos} imageInfos - ファイルタイプ毎の MIME タイプや拡張子の定義
	 * @param {string} dir - サムネイル画像を保存するルートディレクトリ
	 * @param {string} fileBasePath - ベースとなるファイルパス
	 * @param {object} type - 画像タイプ
	 * @param {object} size - 画像サイズ
	 * @param {number} quality - 画像品質
	 */
	constructor(imageInfos: ImageInfos, dir: string, fileBasePath: string, type: ImageType, size: ImageSize, quality?: number) {
		const imageInfo = imageInfos[type];
		if (imageInfo === undefined) {
			throw new Error('Specified image type information is not registered');
		}

		this.#imageInfo = imageInfo;
		this.#dir = dir;
		this.#fileBasePath = fileBasePath;

		this.#type = type;
		this.#size = size;
		this.#quality = quality;
	}

	get fileBasePath(): string {
		return this.#fileBasePath;
	}

	get filePath(): string {
		const paramSize = `s=${this.#size.width}x${this.#size.height}`;
		const paramQuality = `q=${this.#quality}`;

		const params = this.#imageInfo.quality ? [paramSize, paramQuality] : [paramSize];

		return `${this.#fileBasePath}@${params.join(';')}.${this.#imageInfo.extension}`; // e.g `path/to.jpg@s=100x200;q=80.webp`
	}

	get fileFullPath(): string {
		return path.resolve(`${this.#dir}/${this.filePath}`);
	}

	get mime(): string {
		return this.#imageInfo.mime;
	}

	get altType(): ImageType | undefined {
		return this.#imageInfo.alt_type;
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
