import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import * as dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import Log4js from 'log4js';
import qs from 'qs';
import config from './config/express.js';
import BlogUploadController from './controller/api/BlogUploadController.js';
import ThumbImageCreateController from './controller/api/ThumbImageCreateController.js';
import ThumbImageRenderController from './controller/ThumbImageRenderController.js';

dotenv.config({
	path: process.env['NODE_ENV'] === 'production' ? '.env.production' : '.env.development',
});

/* Logger */
const loggerFilePath = process.env['LOGGER'];
if (loggerFilePath === undefined) {
	throw new Error('Logger file path not defined');
}
Log4js.configure(loggerFilePath);
const logger = Log4js.getLogger();

const app = express();

app.set('query parser', (query: string) => qs.parse(query, { delimiter: /[&;]/ }));
app.set('trust proxy', true);
app.set('x-powered-by', false);

app.use(
	(_req, res, next) => {
		/* HSTS */
		res.setHeader('Strict-Transport-Security', config.response.header.hsts);

		/* CSP */
		res.setHeader('Content-Security-Policy', config.response.header.csp);

		/* Report */
		res.setHeader(
			'Reporting-Endpoints',
			Object.entries(config.response.header.reportingEndpoints)
				.map((endpoint) => `${endpoint.at(0) ?? ''}="${endpoint.at(1) ?? ''}"`)
				.join(','),
		);

		/* MIME スニッフィング抑止 */
		res.setHeader('X-Content-Type-Options', 'nosniff');

		next();
	},
	compression({
		threshold: config.response.compression.threshold,
	}),
	express.urlencoded({
		extended: true,
	}),
	(req, res, next) => {
		const requestPath = req.path;

		let requestFilePath: string | undefined; // 実ファイルパス
		if (requestPath.endsWith('/')) {
			/* ディレクトリトップ（e.g. /foo/ ） */
			if (fs.existsSync(`${config.static.root}${requestPath}${config.static.index}`)) {
				requestFilePath = `${requestPath}${config.static.index}`;
			}
		} else if (path.extname(requestPath) === '') {
			/* 拡張子のない URL（e.g. /foo ） */
			if (fs.existsSync(`${config.static.root}${requestPath}${config.static.extension}`)) {
				requestFilePath = `${requestPath}${config.static.extension}`;
			}
		} else if (fs.existsSync(`${config.static.root}${requestPath}`)) {
			/* 拡張子のある URL（e.g. /foo.txt ） */
			requestFilePath = requestPath;
		}

		/* Brotli */
		if (requestFilePath !== undefined && req.method === 'GET' && req.acceptsEncodings('br') === 'br') {
			const brotliFilePath = `${requestFilePath}${config.extension.brotli}`;
			if (fs.existsSync(`${config.static.root}${brotliFilePath}`)) {
				req.url = brotliFilePath;
				res.setHeader('Content-Encoding', 'br');
			}
		}

		next();
	},
	express.static(config.static.root, {
		extensions: [config.static.extension.substring(1)],
		index: [config.static.index],
		setHeaders: (res, localPath) => {
			const requestUrl = res.req.url; // リクエストパス e.g. ('/foo.html.br')
			const requestUrlOrigin = requestUrl.endsWith(config.extension.brotli)
				? requestUrl.substring(0, requestUrl.length - config.extension.brotli.length)
				: requestUrl; // 元ファイル（圧縮ファイルではない）のリクエストパス (e.g. '/foo.html')
			const localPathOrigin = localPath.endsWith(config.extension.brotli)
				? localPath.substring(0, localPath.length - config.extension.brotli.length)
				: localPath; // 元ファイルの絶対パス (e.g. '/var/www/public/foo.html')
			const extensionOrigin = path.extname(localPathOrigin); // 元ファイルの拡張子 (e.g. '.html')

			/* Content-Type */
			const mimeType =
				Object.entries(config.static.headers.mime_type.path)
					.find(([filePath]) => filePath === requestUrlOrigin)
					?.at(1) ??
				Object.entries(config.static.headers.mime_type.extension)
					.find(([fileExtension]) => fileExtension === extensionOrigin)
					?.at(1);
			if (mimeType === undefined) {
				logger.error(`MIME type is undefined: ${requestUrlOrigin}`);
			}
			res.setHeader('Content-Type', mimeType ?? 'application/octet-stream');

			/* Cache-Control */
			const cacheControl =
				config.static.headers.cacheControl.path.find((ccPath) => ccPath.paths.includes(requestUrlOrigin))?.value ??
				config.static.headers.cacheControl.extension.find((ccExt) => ccExt.extensions.includes(extensionOrigin))?.value ??
				config.static.headers.cacheControl.default;
			res.setHeader('Cache-Control', cacheControl);

			/* CSP */
			if (['.html', '.xhtml'].includes(extensionOrigin)) {
				res.setHeader('Content-Security-Policy', config.response.header.cspHtml);
			}
		},
	}),
);

/**
 * サムネイル画像表示
 */
app.get('/thumbimage/:path([^?]+)', async (req, res, next) => {
	try {
		await new ThumbImageRenderController().execute(req, res);
	} catch (e) {
		next(e);
	}
});

/**
 * サムネイル画像生成
 */
app.post('/thumbimage/create', async (req, res, next) => {
	try {
		await new ThumbImageCreateController().execute(req, res);
	} catch (e) {
		next(e);
	}
});

/**
 * ブログ用ファイルアップロード
 */
app.post('/blog/upload', async (req, res, next) => {
	try {
		await new BlogUploadController().execute(req, res);
	} catch (e) {
		next(e);
	}
});

/**
 * エラー処理
 */
app.use((req, res): void => {
	logger.warn(`404 Not Found: ${req.method} ${req.url}`);

	const pagePath = process.env['ERRORPAGE_404'];
	if (pagePath === undefined) {
		throw new Error("404 page's file path not defined");
	}

	res.status(404).sendFile(path.resolve(pagePath));
});
app.use((err: Error, req: Request, res: Response, _next: NextFunction /* eslint-disable-line @typescript-eslint/no-unused-vars */): void => {
	logger.fatal(`${req.method} ${req.url}`, err.stack);

	res.status(500).send(`<!DOCTYPE html>
<html lang=en>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>media.w0s.jp</title>
<h1>500 Internal Server Error</h1>`);
});

/* HTTP Server */
const port = process.env['PORT'];
if (port === undefined) {
	throw new Error('Port not defined');
}

app.listen(Number(port), () => {
	logger.info(`Server is running on http://localhost:${port}`);
});
