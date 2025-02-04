declare namespace ThumbImageDB {
	interface Queue {
		filePath: string;
		type: string;
		width: number;
		height: number;
		quality: number | undefined;
		registeredAt: Date;
	}
}
