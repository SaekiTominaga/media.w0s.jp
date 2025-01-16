import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import app from '../app.js';

await test('type undefined', async () => {
	const res = await app.request('/thumbimage/foo?');

	assert.equal(res.status, 400);
	// The `type` parameter is required
});

await test('type multi', async () => {
	const res = await app.request('/thumbimage/foo?type[];type[]');

	assert.equal(res.status, 400);
	// The `type` parameter can only be singular
});

await test('type invalid value', async () => {
	const res = await app.request('/thumbimage/foo?type=foo');

	assert.equal(res.status, 400);
	// The value of the `type` parameter is not an accepted string
});

await test('w multi', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w[];w[]');

	assert.equal(res.status, 400);
	// The `w` parameter can only be singular
});

await test('w string', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=foo');

	assert.equal(res.status, 400);
	// The value of the `w` parameter must be a positive integer
});

await test('w min', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=0');

	assert.equal(res.status, 400);
	// The value of the `w` parameter must be between 1 and 9999
});

await test('w max', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=10000');

	assert.equal(res.status, 400);
	// The value of the `w` parameter must be between 1 and 9999
});

await test('h multi', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=1;h[];h[]');

	assert.equal(res.status, 400);
	// The `h` parameter can only be singular
});

await test('h string', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=1;h=foo');

	assert.equal(res.status, 400);
	// The value of the `h` parameter must be a positive integer
});

await test('h min', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=1;h=0');

	assert.equal(res.status, 400);
	// The value of the `h` parameter must be between 1 and 9999
});

await test('h max', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=1;h=10000');

	assert.equal(res.status, 400);
	// The value of the `h` parameter must be between 1 and 9999
});

await test('quality multi', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=1;h=1;quality[];quality[]');

	assert.equal(res.status, 400);
	// The `quality` parameter can only be singular
});

await test('quality string', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=1;h=1;quality=foo');

	assert.equal(res.status, 400);
	// The value of the `quality` parameter must be a positive integer
});

await test('quality min', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=1;h=1;quality=0');

	assert.equal(res.status, 400);
	// The value of the `quality` parameter must be between 1 and 100
});

await test('quality max', async () => {
	const res = await app.request('/thumbimage/foo?type=jpeg;w=1;h=1;quality=101');

	assert.equal(res.status, 400);
	// The value of the `quality` parameter must be between 1 and 100
});
