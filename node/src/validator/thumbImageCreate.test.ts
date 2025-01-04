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

await test('file_path undefined', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams(),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `file_path` parameter is invalid');
});

await test('type undefined', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([['file_path', '']]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `type` parameter is invalid');
});

await test('width undefined', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `width` parameter is invalid');
});

await test('width string', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', 'foo'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `width` parameter must be a positive integer');
});

await test('width min', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '0'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `width` parameter must be between 1 and 9999');
});

await test('width max', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '10000'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `width` parameter must be between 1 and 9999');
});

await test('height undefined', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '1'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `height` parameter is invalid');
});

await test('height string', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '1'],
			['height', 'foo'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `height` parameter must be a positive integer');
});

await test('height min', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '1'],
			['height', '0'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `height` parameter must be between 1 and 9999');
});

await test('height max', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '1'],
			['height', '10000'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `height` parameter must be between 1 and 9999');
});

await test('quality multi', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '1'],
			['height', '1'],
			['quality', '0'],
			['quality', '0'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `quality` parameter is invalid');
});

await test('quality string', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '1'],
			['height', '1'],
			['quality', 'foo'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `quality` parameter must be a positive integer');
});

await test('quality min', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '1'],
			['height', '1'],
			['quality', '0'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `quality` parameter must be between 1 and 100');
});

await test('quality max', async () => {
	const res = await app.request('/api/thumbimage-create', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([
			['file_path', ''],
			['type', ''],
			['width', '1'],
			['height', '1'],
			['quality', '101'],
		]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `quality` parameter must be between 1 and 100');
});
