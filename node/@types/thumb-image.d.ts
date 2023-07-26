type ImageType = 'avif' | 'webp' | 'jpeg' | 'png'; // ../configure/thimb-image.json#type のキーに合わせる

interface ImageSize {
	width: number;
	height: number;
}

declare namespace ThumbImageRequest {
	export interface Query {
		readonly path: string;
		readonly type: ImageType;
		readonly width: number | null;
		readonly height: number | null;
		readonly quality: number;
	}
}

declare namespace ThumbImageCreateRequest {
	export interface Query {
		readonly file_path: string;
		readonly type: ImageType;
		readonly width: number;
		readonly height: number;
		readonly quality: number;
	}
}
