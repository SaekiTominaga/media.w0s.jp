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

const app = Express();

app.set('query parser', (query: string) => qs.parse(query, { delimiter: /[&;]/ }));
app.set('trust proxy', true);
app.set('x-powered-by', false);
app.use((req, res, next) => {
	const requestUrl = req.url;

	let requestFilePath: string | undefined; // 実ファイルパス
	if (requestUrl.endsWith('/')) {
		/* ディレクトリトップ（e.g. /foo/ ） */
		const fileName = config.static.indexes?.find((name) => fs.existsSync(`${config.static.root}/${requestUrl}${name}`));
		if (fileName !== undefined) {
			requestFilePath = `${requestUrl}${fileName}`;
		}
	} else if (path.extname(requestUrl) === '') {
		/* 拡張子のない URL（e.g. /foo ） */
		const extension = config.static.extensions?.find((ext) => fs.existsSync(`${config.static.root}/${requestUrl}.${ext}`));
		if (extension !== undefined) {
			requestFilePath = `${requestUrl}.${extension}`;
		}
	} else {
		/* 拡張子のある URL（e.g. /foo.txt ） */
		requestFilePath = requestUrl;
	}

	/* Content-Type */
	const mimeOfPath = Object.entries(<{ [key: string]: string[] }>config.static.headers.mime.path).find(
		([, paths]) => requestFilePath !== undefined && paths.includes(requestFilePath)
	)?.[0]; // ファイルパスから決定される MIME
	const mimeOfExtension = Object.entries(<TypeMap>config.static.headers.mime.extension).find(
		([, extensions]) => requestFilePath !== undefined && extensions.includes(path.extname(requestFilePath).substring(1))
	)?.[0]; // 拡張子から決定される MIME
	const mime = mimeOfPath ?? mimeOfExtension;

	if (mime === undefined) {
		logger.info('MIME が未定義のファイル', requestUrl);
	} else {
		logger.debug('Content-Type', `${requestUrl} - ${mime}`);

		res.setHeader('Content-Type', mime);
	}

	/* HSTS */
	res.setHeader('Strict-Transport-Security', config.response.header.hsts);

	/* CSP */
	if (['.html', '.xhtml'].some((ext) => requestFilePath?.endsWith(ext))) {
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
		extensions: config.static.extensions,
		index: config.static.indexes,
		setHeaders: (res, localPath) => {
			const requestUrl = res.req.url;
			const extension = path.extname(localPath); // 拡張子

			/* Cache */
			if (config.static.headers.cache_control !== undefined) {
				const cacheControlValue =
					config.static.headers.cache_control.path.find((path) => path.paths.includes(requestUrl))?.value ??
					config.static.headers.cache_control.extension.find((ext) => ext.extensions.includes(extension))?.value ??
					config.static.headers.cache_control.default;

				logger.debug('Cache-Control', `${requestUrl} - ${cacheControlValue}`);

				res.setHeader('Cache-Control', cacheControlValue);
			}
		},
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
