export type Info = Record<
	string,
	{
		mime: string;
		extension: string;
		quality: boolean;
		altType?: string;
	}
>;

const info: Info = {
	avif: {
		mime: 'image/avif',
		extension: 'avif',
		quality: true,
		altType: 'webp',
	},
	webp: {
		mime: 'image/webp',
		extension: 'webp',
		quality: true,
	},
	jpeg: {
		mime: 'image/jpeg',
		extension: 'jpeg',
		quality: true,
	},
	png: {
		mime: 'image/png',
		extension: 'png',
		quality: false,
	},
};

export default {
	type: info,
	qualityDefault: 80,
	cacheControl: 'max-age=600',
	origMimeType: {
		'.avif': 'image/avif',
		'.jpeg': 'image/jpeg',
		'.jpg': 'image/jpeg',
		'.png': 'image/png',
		'.svg': 'image/svg+xml;charset=utf-8',
		'.webp': 'image/webp',
	},
};
