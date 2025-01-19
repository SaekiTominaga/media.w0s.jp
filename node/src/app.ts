import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status.js';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import Log4js from 'log4js';
import qs from 'qs';
import config from './config/hono.js';
import blogUpload from './controller/blogUpload.js';
import thumbImageCreate from './controller/thumbImageCreate.js';
import thumbImageRender from './controller/thumbImageRender.js';
import { env } from './util/env.js';
import { getAuth } from './util/auth.js';
import { isApi } from './util/request.js';

dotenv.config({
	path: process.env['NODE_ENV'] === 'production' ? '.env.production' : '.env.development',
});

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
		req.queries = () => qs.parse(search.substring(1), { delimiter: /[&;]/ }) as never;
	}

	await next();
});

app.use(async (context, next) => {
	/* HSTS */
	context.header('Strict-Transport-Security', config.response.header.hsts);

	/* CSP */
	context.header(
		'Content-Security-Policy',
		Object.entries(config.response.header.csp)
			.map(([key, values]) => `${key} ${values.join(' ')}`)
			.join(';'),
	);

	/* Report */
	context.header(
		'Reporting-Endpoints',
		Object.entries(config.response.header.reportingEndpoints)
			.map(([key, value]) => `${key}="${value}"`)
			.join(','),
	);

	/* MIME スニッフィング抑止 */
	context.header('X-Content-Type-Options', 'nosniff');

	await next();
});

app.get('/favicon.ico', async (context, next) => {
	const { res } = context;

	const file = await fs.promises.readFile(`${config.static.root}/favicon.ico`);

	res.headers.set('Content-Type', 'image/svg+xml;charset=utf-8'); // `context.header` だと実際には問題ないが、test で落ちる
	context.body(file);

	await next();
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
				config.static.headers.cacheControl.path.find((ccPath) => ccPath.paths.includes(urlPath))?.value ??
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
		origin: env('THUMBIMAGE_CORS_ORIGINS').split(' '),
		allowMethods: ['GET'],
	}),
);

/* Auth */
const auth = await getAuth();
app.use(
	`/${config.api.dir}/*`,
	basicAuth({
		username: auth.user,
		password: auth.password,
		realm: auth.realm,
		verifyUser: (username, password) => {
			// @ts-expect-error: ts(2551)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const passwordHash = crypto.hash('sha256', password) as string;
			return username === auth.user && passwordHash === auth.password;
		},
		invalidUserMessage: {
			message: config.basicAuth.unauthorizedMessage,
		},
	}),
);

/* Routes */
app.route('/thumbimage/', thumbImageRender);
app.route(`/${config.api.dir}/thumbimage/create`, thumbImageCreate);
app.route(`/${config.api.dir}/blog/upload`, blogUpload);

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
	let title = TITLE_5XX;
	let message: string | undefined;
	if (err instanceof HTTPException) {
		status = err.status;
		message = err.message;

		if (err.status >= 400 && err.status < 500) {
			logger.info(err.status, err.message, context.req.header('User-Agent'));
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
	);
});

/* HTTP Server */
if (process.env['TEST'] !== 'test') {
	const port = env('PORT');
	logger.info(`Server is running on http://localhost:${port}`);

	serve({
		fetch: app.fetch,
		port: Number(port),
	});
}

export default app;
