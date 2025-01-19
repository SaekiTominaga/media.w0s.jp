import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { test, before, after } from 'node:test';
import app from '../app.js';
import ThumbImage from '../object/ThumbImage.js';
import { getAuth } from '../util/auth.js';
import { env } from '../util/env.js';

const auth = await getAuth();
const authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password_orig!}`).toString('base64')}`;

await test('File not found', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: 'foo',
			type: '',
			width: 1,
			height: 1,
			quality: 1,
		}),
	});

	assert.equal(res.status, 204);
	assert.equal(await res.text(), '');
});

await test('create', async (t) => {
	const thumbImage = new ThumbImage(env('THUMBIMAGE_DIR'), {
		fileBasePath: 'sample.jpg',
		type: 'avif',
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

	await t.test('AVIF', async () => {
		const res = await app.request('/api/thumbimage/create', {
			method: 'post',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				path: 'sample.jpg',
				type: 'avif',
				width: 1,
				height: 1,
				quality: 1,
			}),
		});

		assert.equal(res.status, 204);
		assert.equal(await res.text(), '');
		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});
});
