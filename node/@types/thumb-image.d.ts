declare namespace ThumbImageRequest {
	export interface Query {
		path: string;
		type: string;
		width: number;
		max_height: number | null;
		quality: number;
	}
}
