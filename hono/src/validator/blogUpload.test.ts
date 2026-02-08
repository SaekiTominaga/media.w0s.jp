import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import app from '../app.ts';
import { getAuth } from '../util/auth.ts';

const auth = await getAuth();
const authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password_orig!}`).toString('base64')}`;

await test('name undefined', async () => {
	const res = await app.request('/api/blog/upload', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `name` parameter is invalid');
});

await test('type undefined', async () => {
	const res = await app.request('/api/blog/upload', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: '' }),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `type` parameter is invalid');
});

await test('temp undefined', async () => {
	const res = await app.request('/api/blog/upload', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: '',
			type: '',
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `temp` parameter is invalid');
});

await test('size undefined', async () => {
	const res = await app.request('/api/blog/upload', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: '',
			type: '',
			temp: '',
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `size` parameter is invalid');
});

await test('size string', async () => {
	const res = await app.request('/api/blog/upload', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: '',
			type: '',
			temp: '',
			size: 'foo',
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `size` parameter is invalid');
});

await test('size min', async () => {
	const res = await app.request('/api/blog/upload', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: '',
			type: '',
			temp: '',
			size: -1,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `size` parameter must be a positive integer');
});

await test('size decimal', async () => {
	const res = await app.request('/api/blog/upload', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: '',
			type: '',
			temp: '',
			size: 0.1,
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The value of the `size` parameter must be a positive integer');
});

await test('overwrite string', async () => {
	const res = await app.request('/api/blog/upload', {
		method: 'post',
		headers: { Authorization: authorization, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: '',
			type: '',
			temp: '',
			size: 0,
			overwrite: '',
		}),
	});

	assert.equal(res.status, 400);
	assert.equal((await res.json()).message, 'The `overwrite` parameter is invalid');
});
