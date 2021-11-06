declare namespace BlogUploadRequest {
	export interface Query {
		file_name: string;
		mime: string;
		temp_path: string;
		size: number;
		overwrite: boolean;
	}
}
