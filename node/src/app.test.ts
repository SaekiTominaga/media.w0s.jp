import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { test } from 'node:test';
import app from './app.js';
import config from './config/hono.js';
import { getAuth } from './util/auth.js';

await test('Top page', async () => {
	const res = await app.request('/');

	assert.equal(res.status, 200);
	assert.equal(res.headers.get('Content-Type'), 'text/html; charset=utf-8');
	assert.equal(res.headers.get('Cache-Control'), 'max-age=600');
});

await test('Omission of extension', async () => {
	const res = await app.request('/thumbimage');

	assert.equal(res.status, 200);
	assert.equal(res.headers.get('Content-Type'), 'text/html; charset=utf-8');
});

await test('Cache-Control: extension', async () => {
	const res = await app.request('/apple-touch-icon.png');

	assert.equal(res.status, 200);
	assert.equal(res.headers.get('Content-Type'), 'image/png');
	assert.equal(res.headers.get('Cache-Control'), 'max-age=3600');
});

await test('favicon.ico', async () => {
	const res = await app.request('/favicon.ico');

	assert.equal(res.status, 200);
	assert.equal(res.headers.get('Content-Type'), 'image/svg+xml;charset=utf-8');
	assert.equal(res.headers.get('Cache-Control'), 'max-age=604800');
});

await test('Compression', async (t) => {
	await t.test('gzip', async () => {
		const [file, res] = await Promise.all([
			fs.promises.readFile(`${config.static.root}/favicon.ico`),
			app.request('/favicon.ico', { headers: { 'Accept-Encoding': 'gzip,deflate' } }),
		]);

		const fileLength = file.byteLength;
		if (fileLength > config.response.compression.threshold) {
			assert.equal(res.headers.get('Content-Encoding'), 'gzip');
			assert.equal(res.headers.get('Content-Length'), null);
		} else {
			assert.equal(res.headers.get('Content-Encoding'), null);
			assert.equal(res.headers.get('Content-Length'), String(fileLength));
		}
	});

	await t.test('brotli', async () => {
		const [file, res] = await Promise.all([
			fs.promises.readFile(`${config.static.root}/favicon.ico.br`),
			app.request('/favicon.ico', { headers: { 'Accept-Encoding': 'br' } }),
		]);

		assert.equal(res.headers.get('Content-Encoding'), 'br');
		assert.equal(res.headers.get('Content-Length'), String(file.byteLength));
	});
});

await test('404', async (t) => {
	await t.test('normal', async () => {
		const res = await app.request('/foo');

		assert.equal(res.status, 404);
		assert.equal(res.headers.get('Content-Type'), 'text/html; charset=UTF-8');
		assert.equal(
			await res.text(),
			`<!DOCTYPE html>
<html lang=en>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>media.w0s.jp</title>
<h1>404 Not Found</h1>`,
		);
	});

	await t.test('API', async () => {
		const auth = await getAuth();
		const authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password_orig!}`).toString('base64')}`;

		const res = await app.request('/api/', {
			method: 'post',
			headers: { Authorization: authorization },
		});

		assert.equal(res.status, 404);
		assert.equal(res.headers.get('Content-Type'), 'application/json');
		assert.deepStrictEqual(await res.json(), { message: '404 Not Found' });
	});
});
