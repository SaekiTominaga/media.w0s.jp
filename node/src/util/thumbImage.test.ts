import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { test, before, after } from 'node:test';
import config from '../config/hono.ts';
import ThumbImage from '../object/ThumbImage.ts';
import { getSize, create } from './thumbImage.ts';

await test('getSize()', async (t) => {
	await t.test('幅、高さとも未指定', () => {
		assert.equal(getSize({ width: undefined, height: undefined }, { width: 100, height: 200 }).width, 100);
		assert.equal(getSize({ width: undefined, height: undefined }, { width: 100, height: 200 }).height, 200);
	});

	await t.test('幅のみが指定、縮小しない', () => {
		assert.equal(getSize({ width: 100, height: undefined }, { width: 100, height: 200 }).width, 100);
		assert.equal(getSize({ width: 100, height: undefined }, { width: 100, height: 200 }).height, 200);
	});

	await t.test('幅のみが指定、縮小する', () => {
		assert.equal(getSize({ width: 50, height: undefined }, { width: 100, height: 200 }).width, 50);
		assert.equal(getSize({ width: 50, height: undefined }, { width: 100, height: 200 }).height, 100);
	});

	await t.test('高さのみが指定、縮小しない', () => {
		assert.equal(getSize({ width: undefined, height: 200 }, { width: 100, height: 200 }).width, 100);
		assert.equal(getSize({ width: undefined, height: 200 }, { width: 100, height: 200 }).height, 200);
	});

	await t.test('高さのみが指定、縮小する', () => {
		assert.equal(getSize({ width: undefined, height: 100 }, { width: 100, height: 200 }).width, 50);
		assert.equal(getSize({ width: undefined, height: 100 }, { width: 100, height: 200 }).height, 100);
	});

	await t.test('幅、高さが両方指定、縮小しない', () => {
		assert.equal(getSize({ width: 100, height: 200 }, { width: 100, height: 200 }).width, 100);
		assert.equal(getSize({ width: 100, height: 200 }, { width: 100, height: 200 }).height, 200);
	});

	await t.test('幅、高さが両方指定、幅基準に縮小する', () => {
		assert.equal(getSize({ width: 25, height: 100 }, { width: 100, height: 200 }).width, 25);
		assert.equal(getSize({ width: 25, height: 100 }, { width: 100, height: 200 }).height, 50);
	});

	await t.test('幅、高さが両方指定、高さ基準に縮小する', () => {
		assert.equal(getSize({ width: 50, height: 50 }, { width: 100, height: 200 }).width, 25);
		assert.equal(getSize({ width: 50, height: 50 }, { width: 100, height: 200 }).height, 50);
	});
});

await test('create()', async (t) => {
	const dir = '.test';

	before(() => {
		if (fs.existsSync(dir)) {
			throw new Error('Test directory already exists');
		}
	});

	after(async () => {
		await fs.promises.rm(dir, { recursive: true });
	});

	await t.test('AVIF', async () => {
		const thumbImage = new ThumbImage(dir, { fileBasePath: 'test.jpg', type: 'avif', size: { width: 100, height: 200 }, quality: 10 });

		await create(`${config.static.root}/${config.static.directory.image}/sample.jpg`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('WebP', async () => {
		const thumbImage = new ThumbImage(dir, { fileBasePath: 'test.jpg', type: 'webp', size: { width: 100, height: 200 }, quality: 10 });

		await create(`${config.static.root}/${config.static.directory.image}/sample.jpg`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('JPEG', async () => {
		const thumbImage = new ThumbImage(dir, { fileBasePath: 'test.jpg', type: 'jpeg', size: { width: 100, height: 200 }, quality: 10 });

		await create(`${config.static.root}/${config.static.directory.image}/sample.jpg`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('JPEG→PNG', async () => {
		const thumbImage = new ThumbImage(dir, { fileBasePath: 'test-jpeg.jpg', type: 'png', size: { width: 100, height: 200 }, quality: undefined });

		await create(`${config.static.root}/${config.static.directory.image}/sample.jpg`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('PNG8→PNG', async () => {
		const thumbImage = new ThumbImage(dir, { fileBasePath: 'test-png8.png', type: 'png', size: { width: 101, height: 201 }, quality: undefined });

		await create(`${config.static.root}/${config.static.directory.image}/sample-png8.png`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('PNG32→PNG', async () => {
		const thumbImage = new ThumbImage(dir, { fileBasePath: 'test-png32.png', type: 'png', size: { width: 102, height: 202 }, quality: undefined });

		await create(`${config.static.root}/${config.static.directory.image}/sample-png32.png`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});
});
