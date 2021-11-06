declare namespace ThumbImageRequest {
	export interface Query {
		path: string;
		type: string;
		width: number | null;
		height: number | null;
		quality: number;
	}
}

declare namespace ThumbImageCreateRequest {
	export interface Query {
		path: string;
		type: string;
		width: number;
		height: number;
		quality: number;
	}
}
