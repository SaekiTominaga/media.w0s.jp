import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import Log4js from 'log4js';
import qs from 'qs';
import { env } from '@w0s/env-value-type';
import config from './config/hono.ts';
import { blogUploadApp } from './controller/blogUpload.ts';
import { thumbImageCreateApp } from './controller/thumbImageCreate.ts';
import { thumbImageRenderApp } from './controller/thumbImageRender.ts';
import { getAuth } from './util/auth.ts';
import {
	supportCompressionEncoding as supportCompressEncodingHeader,
	csp as cspHeader,
	reportingEndpoints as reportingEndpointsHeader,
} from './util/httpHeader.ts';
import { isApi } from './util/request.ts';

loadEnvFile(process.env['NODE_ENV'] === 'production' ? '.env.production' : '.env.development');

/* Logger */
Log4js.configure(env('LOGGER'));
const logger = Log4js.getLogger();

/* Hono */
const app = new Hono();

app.use(
	compress({
		threshold: config.response.compression.threshold,
	}),
);

app.use(async (context, next) => {
	const { req } = context;

	const { search } = new URL(req.url);
	if (search !== '') {
		/* query paeser カスタマイズ https://github.com/honojs/hono/issues/3667#issuecomment-2503499238 */
		req.queries = () => qs.parse(search.substring(1), { delimiter: /[&;]/v }) as never;
	}

	await next();
});

app.use(async (context, next) => {
	/* HSTS */
	context.header('Strict-Transport-Security', config.response.header.hsts);

	/* CSP */
	context.header('Content-Security-Policy', cspHeader(config.response.header.csp));

	/* Report */
	context.header('Reporting-Endpoints', reportingEndpointsHeader(config.response.header.reportingEndpoints));

	/* MIME スニッフィング抑止 */
	context.header('X-Content-Type-Options', 'nosniff');

	await next();
});

app.get('/favicon.ico', async (context) => {
	const { req } = context;

	let compressExtension: string | undefined;
	let responseContentEncoding: string | undefined;

	if (supportCompressEncodingHeader(req.header('Accept-Encoding'), 'br')) {
		compressExtension = '.br';
		responseContentEncoding = 'br';
	}

	const file = await fs.promises.readFile(`${config.static.root}/favicon.svg${compressExtension ?? ''}`);

	context.header('Content-Type', 'image/svg+xml;charset=utf-8');
	if (responseContentEncoding !== undefined) {
		context.header('Content-Encoding', responseContentEncoding);
	}
	context.header('Cache-Control', 'max-age=604800');
	return context.body(Buffer.from(file));
});

app.use(
	serveStatic({
		root: config.static.root,
		index: config.static.index,
		precompressed: true,
		rewriteRequestPath: (urlPath) => {
			if (urlPath.endsWith('/') || urlPath.includes('.')) {
				return urlPath;
			}

			return `${urlPath}${config.static.extension}`;
		},
		onFound: (localPath, context) => {
			const urlPath = path.normalize(localPath).substring(path.normalize(config.static.root).length).replaceAll(path.sep, '/'); // URL のパス部分 e.g. ('/foo.html')
			const urlExtension = path.extname(urlPath); // URL の拡張子部分 (e.g. '.html')

			/* Cache-Control */
			const cacheControl =
				config.static.headers.cacheControl.extension.find((ccExt) => ccExt.extensions.includes(urlExtension))?.value ??
				config.static.headers.cacheControl.default;
			context.header('Cache-Control', cacheControl);
		},
	}),
);

/* CORS */
app.use(
	'/thumbimage/*',
	cors({
		origin: env('THUMBIMAGE_CORS_ORIGINS', 'string[]'),
		allowMethods: ['GET'],
	}),
);

/* Auth */
const auth = await getAuth();
app.use(
	`/${config.api.dir}/thumbimage/create`,
	basicAuth({
		verifyUser: (username, password) => {
			const passwordHash = crypto.hash('sha256', password);
			return username === auth.user && passwordHash === auth.password;
		},
		realm: auth.realm,
		invalidUserMessage: {
			message: config.basicAuth.unauthorizedMessage,
		},
	}),
);

/* Routes */
app.route('/thumbimage/', thumbImageRenderApp);
app.route(`/${config.api.dir}/thumbimage/create`, thumbImageCreateApp);
app.route(`/${config.api.dir}/blog/upload`, blogUploadApp);

/* Error pages */
app.notFound((context) => {
	const TITLE = '404 Not Found';

	if (isApi(context)) {
		return context.json({ message: TITLE }, 404);
	}

	return context.html(
		`<!DOCTYPE html>
<html lang=en>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>media.w0s.jp</title>
<h1>${TITLE}</h1>`,
		404,
	);
});
app.onError((err, context) => {
	const TITLE_4XX = 'Client error';
	const TITLE_5XX = 'Server error';

	let status: ContentfulStatusCode = 500;
	const headers = new Headers();
	let title = TITLE_5XX;
	let message: string | undefined;
	if (err instanceof HTTPException) {
		status = err.status;
		message = err.message;

		if (err.status >= 400 && err.status < 500) {
			if (err.status === 401) {
				/* 手動で `WWW-Authenticate` ヘッダーを設定 https://github.com/honojs/hono/issues/952 */
				const wwwAuthenticate = err.res?.headers.get('WWW-Authenticate');
				if (wwwAuthenticate !== null && wwwAuthenticate !== undefined) {
					headers.set('WWW-Authenticate', wwwAuthenticate);
				}
			} else {
				logger.info(err.status, err.message, context.req.header('User-Agent'));
			}

			title = TITLE_4XX;
		} else {
			logger.error(err.message);
		}
	} else {
		logger.fatal(err.message);
	}

	if (isApi(context)) {
		return context.json({ message: message ?? title }, status);
	}

	return context.html(
		`<!DOCTYPE html>
<html lang=en>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>media.w0s.jp</title>
<h1>${title}</h1>`,
		status,
		Object.fromEntries(headers.entries()),
	);
});

/* HTTP Server */
if (process.env['TEST'] !== 'true') {
	const port = env('PORT', 'number');
	logger.info(`Server is running on http://localhost:${String(port)}`);

	serve({
		fetch: app.fetch,
		port: port,
	});
}

export default app;
