import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import app from '../app.js';
import { getAuth } from '../util/auth.js';

const auth = await getAuth();
const authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password_orig!}`).toString('base64')}`;

await test('path undefined', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `path` parameter is invalid');
});

await test('type undefined', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({ path: '' }),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `type` parameter is invalid');
});

await test('width undefined', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `width` parameter is invalid');
});

await test('width string', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 'foo',
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `width` parameter is invalid');
});

await test('width min', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 0,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `width` parameter must be between 1 and 9999');
});

await test('width max', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 10000,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `width` parameter must be between 1 and 9999');
});

await test('width decimal', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1.1,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `width` parameter must be an integer');
});

await test('height undefined', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `height` parameter is invalid');
});

await test('height string', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
			height: 'foo',
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `height` parameter is invalid');
});

await test('height min', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
			height: 0,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `height` parameter must be between 1 and 9999');
});

await test('height max', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
			height: 10000,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `height` parameter must be between 1 and 9999');
});

await test('height decimal', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
			height: 1.1,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `height` parameter must be an integer');
});

await test('quality string', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
			height: 1,
			quality: 'foo',
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `quality` parameter is invalid');
});

await test('quality min', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
			height: 1,
			quality: 0,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `quality` parameter must be between 1 and 100');
});

await test('quality max', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
			height: 1,
			quality: 101,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `quality` parameter must be between 1 and 100');
});

await test('quality decimal', async () => {
	const res = await app.request('/api/thumbimage/create', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: '',
			type: '',
			width: 1,
			height: 1,
			quality: 1.1,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `quality` parameter must be an integer');
});
