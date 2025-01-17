export default {
	response: {
		header: {
			hsts: 'max-age=31536000',
			csp: {
				'frame-ancestors': ["'self'"],
				'report-uri': ['https://report.w0s.jp/report/csp'],
				'report-to': ['csp'],
			},
			reportingEndpoints: {
				csp: 'https://report.w0s.jp/report/csp',
			},
		},
		compression: {
			threshold: 512,
		},
	},
	static: {
		root: 'public',
		directory: {
			image: 'image',
			audio: 'audio',
			video: 'video',
		},
		index: 'index.html',
		extension: '.html', // URL 上で省略できる拡張子
		headers: {
			cacheControl: {
				default: 'max-age=600',
				path: [
					{
						paths: ['/favicon.ico'],
						value: 'max-age=604800',
					},
				],
				extension: [
					{
						extensions: ['.webp', '.jpg', '.jpeg', '.png', '.svg', '.m4a', '.mp4', '.webm'],
						value: 'max-age=3600',
					},
				],
			},
		},
	},
	basicAuth: {
		unauthorizedMessage: 'Unauthorized',
	},
	api: {
		dir: 'api', // API を示すディレクトリ
		allowMethods: ['POST'],
	},
};
