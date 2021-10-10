import BlogUploadController from './controller/BlogUploadController.js';
import compression from 'compression';
import Express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import Log4js from 'log4js';
import path from 'path';
import qs from 'qs';
import ThumbImageController from './controller/ThumbImageController.js';
import { MediaW0SJp as Configure } from '../configure/type/common';
import { TypeMap } from 'mime';

/* 設定ファイル読み込み */
const config = <Configure>JSON.parse(fs.readFileSync('node/configure/common.json', 'utf8'));

/* Logger 設定 */
Log4js.configure(config.logger.path);
const logger = Log4js.getLogger();

/* Express 設定 */
Express.static.mime.define(<TypeMap>config.response.mime_extension); // 静的ファイルの MIME

const app = Express();

app.set('query parser', (query: string) => qs.parse(query, { delimiter: /[&;]/ }));
app.set('trust proxy', true);
app.set('x-powered-by', false);
app.use((req, res, next) => {
	const requestUrl = req.url;
	const html = /(^\/[^.]*$)|(\.x?html$)/.test(requestUrl);

	/* 特殊なファイルパスの MIME */
	const mimeOfPath = Object.entries(<{ [key: string]: string[] }>config.response.mime_path).find(([, paths]) => paths.includes(requestUrl))?.[0];
	if (mimeOfPath !== undefined) {
		res.setHeader('Content-Type', mimeOfPath);
	}

	/* HSTS */
	res.setHeader('Strict-Transport-Security', config.response.header.hsts);

	/* CSP */
	if (html) {
		res.setHeader('Content-Security-Policy', config.response.header.csp_html);
	} else {
		res.setHeader('Content-Security-Policy', config.response.header.csp);
	}

	/* MIME スニッフィング抑止 */
	res.setHeader('X-Content-Type-Options', 'nosniff');

	next();
});
app.use(
	compression({
		threshold: config.response.compression.threshold,
	})
);
app.use(Express.urlencoded({ limit: 1000000 })); // 1MB
app.use(
	Express.static(config.static.root, {
		extensions: config.static.options.extensions,
		index: config.static.options.index,
		maxAge: config.static.options.max_age,
	})
);

/**
 * サムネイル画像の表示
 */
app.get('/thumbimage/:path([^?]+)', async (req, res, next) => {
	try {
		await new ThumbImageController(config).execute(req, res);
	} catch (e) {
		next(e);
	}
});

/**
 * ブログ用ファイルアップロード
 */
app.post('/blogupload', async (req, res, next) => {
	try {
		await new BlogUploadController(config).execute(req, res);
	} catch (e) {
		next(e);
	}
});

/**
 * エラー処理
 */
app.use((req, res): void => {
	logger.warn(`404 Not Found: ${req.method} ${req.url}`);
	res.status(404).sendFile(path.resolve(config.errorpage.path_404));
});
app.use((err: Error, req: Request, res: Response, _next: NextFunction /* eslint-disable-line @typescript-eslint/no-unused-vars */): void => {
	logger.fatal(`${req.method} ${req.url}`, err.stack);
	res.status(500).send(`<!DOCTYPE html>
<html lang=en>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>media.w0s.jp</title>
<h1>500 Internal Server Error</h1>`);
});

/**
 * HTTP サーバー起動
 */
app.listen(config.port, () => {
	logger.info(`Example app listening at http://localhost:${config.port}`);
});
