import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { test, before, beforeEach, after } from 'node:test';
import app from '../app.js';
import configBlogUpload from '../config/blog-upload.js';
import { getAuth } from '../util/auth.js';

const auth = await getAuth();
const authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password_orig!}`).toString('base64')}`;

await test('upload', async (t) => {
	const tempPath = '_test-temp';

	before(() => {
		if (fs.existsSync(tempPath)) {
			throw new Error('temp file already exists');
		}
	});

	beforeEach(async () => {
		await fs.promises.writeFile(tempPath, 'temp');
	});

	after(async () => {
		if (fs.existsSync(tempPath)) {
			await fs.promises.unlink(tempPath);
		}
	});

	await t.test('image', async () => {
		const fileName = '_test-upload-image';

		const res = await app.request('/api/blog-upload', {
			method: 'post',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: fileName,
				type: 'image/xxx',
				temp: tempPath,
				size: 0,
			}),
		});

		await fs.promises.unlink(`${configBlogUpload.image.dir}/${fileName}`);

		assert.equal(res.status, 200);
		assert.deepStrictEqual(await res.json(), { name: fileName, size: 0, code: 1, message: 'File upload was successful.' });
	});

	await t.test('video', async () => {
		const filename = '_test-upload-video';

		const res = await app.request('/api/blog-upload', {
			method: 'post',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: filename,
				type: 'video/xxx',
				temp: tempPath,
				size: 0,
			}),
		});

		await fs.promises.unlink(`${configBlogUpload.video.dir}/${filename}`);

		assert.equal(res.status, 200);
		assert.deepStrictEqual(await res.json(), { name: filename, size: 0, code: 1, message: 'File upload was successful.' });
	});

	await t.test('text', async () => {
		const filename = '_test-upload-text';

		const res = await app.request('/api/blog-upload', {
			method: 'post',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: filename,
				type: 'text/xxx',
				temp: tempPath,
				size: 0,
			}),
		});

		assert.equal(res.status, 200);
		assert.deepStrictEqual(await res.json(), {
			name: filename,
			size: 0,
			code: 11,
			message: 'The upload was not executed because it is an unsupported MIME type.',
		});
	});
});

await test('overwrite', async (t) => {
	const tempPath = '_test-temp';
	const filename = '_test-overwrite';

	before(() => {
		if (fs.existsSync(tempPath)) {
			throw new Error('temp file already exists');
		}
	});

	beforeEach(async () => {
		await fs.promises.writeFile(tempPath, 'temp');
	});

	after(async () => {
		if (fs.existsSync(tempPath)) {
			await fs.promises.unlink(tempPath);
		}

		await fs.promises.unlink(`${configBlogUpload.image.dir}/${filename}`);
	});

	await t.test('First file upload', async () => {
		const res = await app.request('/api/blog-upload', {
			method: 'post',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: filename,
				type: 'image/xxx',
				temp: tempPath,
				size: 0,
			}),
		});

		assert.equal(res.status, 200);
		assert.deepStrictEqual(await res.json(), { name: filename, size: 0, code: 1, message: 'File upload was successful.' });
	});

	await t.test('Block file overwriting', async () => {
		const res = await app.request('/api/blog-upload', {
			method: 'post',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: filename,
				type: 'image/xxx',
				temp: tempPath,
				size: 0,
			}),
		});

		assert.equal(res.status, 200);
		assert.deepStrictEqual(await res.json(), { name: filename, size: 0, code: 12, message: 'The upload was not executed because the file already exists.' });
	});

	await t.test('File overwritten', async () => {
		const res = await app.request('/api/blog-upload', {
			method: 'post',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: filename,
				type: 'image/xxx',
				temp: tempPath,
				size: 0,
				overwrite: true,
			}),
		});

		assert.equal(res.status, 200);
		assert.deepStrictEqual(await res.json(), { name: filename, size: 0, code: 1, message: 'File upload was successful.' });
	});
});
