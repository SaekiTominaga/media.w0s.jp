import config, { type Info } from '../config/thumb-image.ts';
import type { Size } from '../../@types/util.d.ts';

/**
 * サムネイル画像
 */
export default class ThumbImage {
	/* ファイルタイプ毎の MIME タイプや拡張子の定義 */
	readonly #imageInfo: Info;

	/* サムネイル画像を保存するルートディレクトリ */
	readonly #dir: string;

	/* ベースとなるファイルパス */
	readonly #fileBasePath: string;

	/* 画像タイプ */
	#type: string;

	/* 画像の大きさ */
	#size: Size;

	/* 画像品質 */
	#quality: number | undefined;

	/**
	 * @param dir - サムネイル画像を保存するルートディレクトリ
	 * @param file - ファイル情報
	 * @param file.fileBasePath - ベースとなるファイルパス
	 * @param file.type - 画像タイプ
	 * @param file.size - 画像サイズ
	 * @param file.quality - 画像品質
	 */
	constructor(dir: string, file: Readonly<{ fileBasePath: string; type: string; size: Size; quality: number | undefined }>) {
		this.#dir = dir;

		this.#imageInfo = config.type;
		this.#fileBasePath = file.fileBasePath;

		this.#type = file.type;
		this.#size = file.size;
		this.#quality = file.quality;
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
		return `${this.#dir}/${this.filePath}`;
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

	get size(): Size {
		return this.#size;
	}

	set size(size: Size) {
		this.#size = size;
	}

	get quality(): number | undefined {
		return this.#quality;
	}

	set quality(quality: number | undefined) {
		this.#quality = quality;
	}
}
