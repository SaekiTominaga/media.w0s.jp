export default {
	extension: {
		brotli: '.br',
	},
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
			threshold: '512',
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
			mime_type: {
				path: {
					'/favicon.ico': 'image/svg+xml;charset=utf-8',
				},
				extension: {
					'.m4a': 'audio/aac',
					'.jpg': 'image/jpeg',
					'.jpeg': 'image/jpeg',
					'.png': 'image/png',
					'.svg': 'image/svg+xml;charset=utf-8',
					'.webp': 'image/webp',
					'.css': 'text/css;charset=utf-8',
					'.html': 'text/html;charset=utf-8',
					'.txt': 'text/plain;charset=utf-8',
					'.vtt': 'text/vtt',
					'.mp4': 'video/mp4',
					'.webm': 'video/webm',
				},
			},
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
};
