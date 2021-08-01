declare namespace BlogUploadRequest {
	export interface Query {
		file_name: string | null;
		mime: string | null;
		temp_path: string | null;
		size: number | null;
		overwrite: boolean;
	}
}
