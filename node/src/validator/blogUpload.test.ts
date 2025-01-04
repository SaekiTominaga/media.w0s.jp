import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { test } from 'node:test';
import app from '../app.js';

const authFilePath = process.env['AUTH_ADMIN'];
if (authFilePath === undefined) {
	throw new Error('Auth file not defined');
}
const authFile = JSON.parse((await fs.promises.readFile(authFilePath)).toString()) as { user: string; password_orig: string };

const authorization = `Basic ${Buffer.from(`${authFile.user}:${authFile.password_orig}`).toString('base64')}`;

await test('name undefined', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams(),
	});

	assert.equal(res.status, 400);
	assert.equal(await res.text(), 'The `name` parameter is invalid');
});

await test('type undefined', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([['name', '']]),
	});

	assert.equal(res.status, 400);
	assert.equal(await res.text(), 'The `type` parameter is invalid');
});

await test('temppath undefined', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['name', ''],
			['type', ''],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal(await res.text(), 'The `temppath` parameter is invalid');
});

await test('size undefined', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['name', ''],
			['type', ''],
			['temppath', ''],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal(await res.text(), 'The `size` parameter is invalid');
});

await test('size string', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['name', ''],
			['type', ''],
			['temppath', ''],
			['size', 'foo'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal(await res.text(), 'The value of the `size` parameter must be a positive integer');
});

await test('size min', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['name', ''],
			['type', ''],
			['temppath', ''],
			['size', '-1'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal(await res.text(), 'The value of the `size` parameter must be a positive integer');
});

await test('overwrite multi', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['name', ''],
			['type', ''],
			['temppath', ''],
			['size', '0'],
			['overwrite', ''],
			['overwrite', ''],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal(await res.text(), 'The `overwrite` parameter is invalid');
});
