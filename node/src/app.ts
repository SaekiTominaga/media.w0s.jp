import BlogUploadController from './controller/BlogUploadController.js';
import compression from 'compression';
import Express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import Log4js from 'log4js';
import path from 'path';
import qs from 'qs';
import ThumbImageCreateController from './controller/api/ThumbImageCreateController.js';
import ThumbImageRenderController from './controller/ThumbImageRenderController.js';
import { MediaW0SJp as Configure } from '../configure/type/common';

/* 設定ファイル読み込み */
const config = <Configure>JSON.parse(fs.readFileSync('node/configure/common.json', 'utf8'));

/* Logger 設定 */
Log4js.configure(config.logger.path);
const logger = Log4js.getLogger();

const app = Express();

const EXTENTIONS: { readonly [s: string]: string } = {
	brotli: '.br',
	map: '.map',
}; // 静的ファイル拡張子の定義

app.set('query parser', (query: string) => qs.parse(query, { delimiter: /[&;]/ }));
app.set('trust proxy', true);
app.set('x-powered-by', false);
app.use((req, res, next) => {
	const requestPath = req.path;

	let requestFilePath: string | undefined; // 実ファイルパス
	if (requestPath.endsWith('/')) {
		/* ディレクトリトップ（e.g. /foo/ ） */
		const fileName = config.static.indexes?.find((name) => fs.existsSync(`${config.static.root}/${requestPath}${name}`));
		if (fileName !== undefined) {
			requestFilePath = `${requestPath}${fileName}`;
		}
	} else if (path.extname(requestPath) === '') {
		/* 拡張子のない URL（e.g. /foo ） */
		const extension = config.static.extensions?.find((ext) => fs.existsSync(`${config.static.root}/${requestPath}.${ext}`));
		if (extension !== undefined) {
			requestFilePath = `${requestPath}.${extension}`;
		}
	} else {
		/* 拡張子のある URL（e.g. /foo.txt ） */
		if (fs.existsSync(`${config.static.root}/${requestPath}`)) {
			requestFilePath = requestPath;
		}
	}

	/* Brotli */
	if (requestFilePath !== undefined && req.method === 'GET' && req.acceptsEncodings('br') === 'br') {
		const brotliFilePath = `${requestFilePath}${EXTENTIONS.brotli}`;
		if (fs.existsSync(`${config.static.root}/${brotliFilePath}`)) {
			req.url = brotliFilePath;
			res.setHeader('Content-Encoding', 'br');
		}
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
app.use(
	Express.urlencoded({
		extended: true,
	})
);
app.use(
	Express.static(config.static.root, {
		extensions: config.static.extensions,
		index: config.static.indexes,
		setHeaders: (res, localPath) => {
			const requestUrl = res.req.url; // リクエストパス e.g. ('/foo.html.br')
			const requestUrlOrigin = requestUrl.endsWith(EXTENTIONS.brotli) ? requestUrl.substring(0, requestUrl.length - EXTENTIONS.brotli.length) : requestUrl; // 元ファイル（圧縮ファイルではない）のリクエストパス (e.g. '/foo.html')
			const localPathOrigin = localPath.endsWith(EXTENTIONS.brotli) ? localPath.substring(0, localPath.length - EXTENTIONS.brotli.length) : localPath; // 元ファイルの絶対パス (e.g. '/var/www/public/foo.html')
			const extensionOrigin = path.extname(localPathOrigin); // 元ファイルの拡張子 (e.g. '.html')

			/* Content-Type */
			const mime =
				Object.entries(config.static.headers.mime.path).find(([, paths]) => paths.includes(requestUrlOrigin))?.[0] ??
				Object.entries(config.static.headers.mime.extension).find(([, extensions]) => extensions.includes(extensionOrigin.substring(1)))?.[0];
			if (mime === undefined) {
				logger.error('MIME が未定義のファイル', requestUrlOrigin);
			}
			res.setHeader('Content-Type', mime ?? 'application/octet-stream');

			/* Cache-Control */
			if (config.static.headers.cache_control !== undefined) {
				const cacheControlValue =
					config.static.headers.cache_control.path.find((path) => path.paths.includes(requestUrlOrigin))?.value ??
					config.static.headers.cache_control.extension.find((ext) => ext.extensions.includes(extensionOrigin))?.value ??
					config.static.headers.cache_control.default;

				res.setHeader('Cache-Control', cacheControlValue);
			}

			/* Cross-Origin-* */
			if (
				[config.static.directory.image, config.static.directory.audio, config.static.directory.video].find((urlPath) =>
					requestUrlOrigin.startsWith(`/${urlPath}/`)
				)
			) {
				res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
			}
		},
	})
);

/**
 * サムネイル画像表示
 */
app.get('/thumbimage/:path([^?]+)', async (req, res, next) => {
	try {
		await new ThumbImageRenderController(config).execute(req, res);
	} catch (e) {
		next(e);
	}
});

/**
 * サムネイル画像生成
 */
 app.post('/thumbimage/create', async (req, res, next) => {
	try {
		await new ThumbImageCreateController(config).execute(req, res);
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
