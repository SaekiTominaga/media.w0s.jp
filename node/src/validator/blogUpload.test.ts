import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import app from '../app.js';
import { getAuth } from '../util/auth.js';

const auth = await getAuth();
const authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password_orig!}`).toString('base64')}`;

await test('name undefined', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams(),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `name` parameter is invalid');
});

await test('type undefined', async () => {
	const res = await app.request('/api/blog-upload', {
		method: 'post',
		headers: { Authorization: authorization },
		body: new URLSearchParams([['name', '']]),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `type` parameter is invalid');
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
	assert.equal((await res.json()).message, 'The `temppath` parameter is invalid');
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
	assert.equal((await res.json()).message, 'The `size` parameter is invalid');
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
	assert.equal((await res.json()).message, 'The value of the `size` parameter must be a positive integer');
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
	assert.equal((await res.json()).message, 'The value of the `size` parameter must be a positive integer');
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
	assert.equal((await res.json()).message, 'The `overwrite` parameter is invalid');
});
