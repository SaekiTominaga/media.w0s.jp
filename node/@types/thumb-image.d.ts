declare namespace ThumbImageRequest {
	export interface Query {
		path: string;
		type: string | null;
		width: string | null;
		max_height: string | null;
		quality: string | null;
	}
}
