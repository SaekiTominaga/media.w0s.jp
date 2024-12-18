import path from 'node:path';
import config, { type Info as ImageInfo } from '../config/thumb-image.js';

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
	#type: string;

	/* 画像の大きさ */
	#size: ImageSize;

	/* 画像品質 */
	#quality: number | undefined;

	/**
	 * @param option -
	 * @param option.fileBasePath - ベースとなるファイルパス
	 * @param option.type - 画像タイプ
	 * @param option.size - 画像サイズ
	 * @param option.quality - 画像品質
	 */
	constructor(option: { fileBasePath: string; type: string; size: ImageSize; quality?: number }) {
		const dir = process.env['THUMBIMAGE_DIR'];
		if (dir === undefined) {
			throw new Error('thumbimage directory not defined');
		}
		this.#dir = dir;

		this.#imageInfo = config.type;
		this.#fileBasePath = option.fileBasePath;

		this.#type = option.type;
		this.#size = option.size;
		this.#quality = option.quality;
	}

	/**
	 * 画像定義を取得する
	 *
	 * @returns MIME タイプや拡張子の定義
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

		const paramSize = `s=${String(this.#size.width)}x${String(this.#size.height)}`;
		const paramQuality = `q=${String(this.#quality)}`;

		const params = imageInfo.quality ? [paramSize, paramQuality] : [paramSize];

		return `${this.#fileBasePath}@${params.join(';')}.${imageInfo.extension}`; // e.g `path/to.jpg@s=100x200;q=80.webp`
	}

	get fileFullPath(): string {
		return path.resolve(`${this.#dir}/${this.filePath}`);
	}

	get mime(): string {
		return this.#getImageInfo().mime;
	}

	get altType(): string | undefined {
		return this.#getImageInfo().altType;
	}

	get type(): string {
		return this.#type;
	}

	set type(type: string) {
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
