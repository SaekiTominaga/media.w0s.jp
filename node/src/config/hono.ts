export default {
	response: {
		header: {
			hsts: 'max-age=31536000',
			csp: "frame-ancestors 'self'; report-uri https://w0sjp.report-uri.com/r/d/csp/enforce; report-to default",
			cspHtml:
				"default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'; script-src-elem 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline'; report-uri https://w0sjp.report-uri.com/r/d/csp/enforce; report-to default",
			reportingEndpoints: {
				default: 'https://w0sjp.report-uri.com/a/d/g',
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
						extensions: ['.webp', '.jpg', '.jpeg', '.png', '.svg'],
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
	},
};
