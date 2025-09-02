import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { test, before, after } from 'node:test';
import app from '../app.ts';
import config from '../config/hono.ts';
import ThumbImage from '../object/ThumbImage.ts';
import { env } from '../util/env.ts';

const imageDir = `${config.static.root}/${config.static.directory.image}`;

await test('cors', async () => {
	const res = await app.request('/thumbimage/foo', {
		headers: new Headers({ Origin: 'http://example.com' }),
	});

	assert.equal(res.status, 403);
	// `Access-Control-Allow-Origin` header does not exist
});

await test('not found', async () => {
	const res = await app.request('/thumbimage/foo?type=webp;w=1;h=1;quality=1');

	assert.equal(res.status, 404);
	assert.equal(
		await res.text(),
		`<!DOCTYPE html>
<html lang=en>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>media.w0s.jp</title>
<h1>Client error</h1>`,
	);
});

await test('orig image', async () => {
	const [file, res] = await Promise.all([fs.promises.readFile(`${imageDir}/sample.jpg`), app.request('/thumbimage/sample.jpg?type=webp;w=1;h=1;quality=1')]);

	assert.equal(res.status, 200);
	assert.equal(res.headers.get('Content-Length'), String(file.byteLength));
	assert.equal(res.headers.get('Content-Type'), 'image/jpeg');
});

await test('thumb image', async (t) => {
	const thumbImage = new ThumbImage(env('THUMBIMAGE_DIR'), {
		fileBasePath: 'sample.jpg',
		type: 'webp',
		size: { width: 1, height: 1 },
		quality: 1,
	});

	before(() => {
		if (fs.existsSync(thumbImage.fileFullPath)) {
			throw new Error('thumbnail image already exists');
		}
	});

	after(async () => {
		await fs.promises.unlink(thumbImage.fileFullPath);
	});

	await t.test('create', async () => {
		const res = await app.request('/thumbimage/sample.jpg?type=webp;w=1;h=1;quality=1', {
			headers: { 'Sec-Fetch-Mode': 'cors' },
		});

		assert.equal(res.status, 200);
		assert.equal(res.headers.get('Content-Type'), 'image/webp');
		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('exist', async () => {
		const res = await app.request('/thumbimage/sample.jpg?type=webp;w=1;h=1;quality=1', {
			headers: { 'Sec-Fetch-Mode': 'cors' },
		});

		assert.equal(res.status, 200);
		assert.equal(res.headers.get('Content-Type'), 'image/webp');
	});
});

await test('thumb image - alt type', async (t) => {
	const thumbImage = new ThumbImage(env('THUMBIMAGE_DIR'), {
		fileBasePath: 'sample.jpg',
		type: 'avif',
		size: { width: 1, height: 1 },
		quality: 1,
	});

	before(() => {
		if (thumbImage.altType === undefined) {
			throw new Error('altType is not set');
		}
		thumbImage.type = thumbImage.altType;

		if (fs.existsSync(thumbImage.fileFullPath)) {
			throw new Error('thumbnail image already exists');
		}
	});

	after(async () => {
		await fs.promises.unlink(thumbImage.fileFullPath);
	});

	await t.test('create', async () => {
		const res = await app.request('/thumbimage/sample.jpg?type=avif;w=1;h=1;quality=1', {
			headers: { 'Sec-Fetch-Mode': 'cors' },
		});

		assert.equal(res.status, 200);
		assert.equal(res.headers.get('Content-Type'), 'image/webp');
	});

	await t.test('exist', async () => {
		const res = await app.request('/thumbimage/sample.jpg?type=avif;w=1;h=1;quality=1', {
			headers: { 'Sec-Fetch-Mode': 'cors' },
		});

		assert.equal(res.status, 200);
		assert.equal(res.headers.get('Content-Type'), 'image/webp');
	});
});
