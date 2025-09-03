import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { test, before, after } from 'node:test';
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
	const INPUT_DIR = 'test';
	const OUTPUT_DIR = '.temp';

	before(() => {
		if (fs.existsSync(OUTPUT_DIR)) {
			throw new Error('Test directory already exists');
		}
	});

	after(async () => {
		await fs.promises.rm(OUTPUT_DIR, { recursive: true });
	});

	await t.test('JPEG→AVIF', async () => {
		const FILENAME = 'sample-jpeg.jpg';

		const thumbImage = new ThumbImage(OUTPUT_DIR, { fileBasePath: FILENAME, type: 'avif', size: { width: 100, height: 200 }, quality: 10 });

		await create(`${INPUT_DIR}/${FILENAME}`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('JPEG→WebP', async () => {
		const FILENAME = 'sample-jpeg.jpg';

		const thumbImage = new ThumbImage(OUTPUT_DIR, { fileBasePath: FILENAME, type: 'webp', size: { width: 100, height: 200 }, quality: 10 });

		await create(`${INPUT_DIR}/${FILENAME}`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('JPEG→JPEG', async () => {
		const FILENAME = 'sample-jpeg.jpg';

		const thumbImage = new ThumbImage(OUTPUT_DIR, { fileBasePath: FILENAME, type: 'jpeg', size: { width: 100, height: 200 }, quality: 10 });

		await create(`${INPUT_DIR}/${FILENAME}`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('JPEG→PNG', async () => {
		const FILENAME = 'sample-jpeg.jpg';

		const thumbImage = new ThumbImage(OUTPUT_DIR, { fileBasePath: FILENAME, type: 'png', size: { width: 100, height: 200 }, quality: undefined });

		await create(`${INPUT_DIR}/${FILENAME}`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('PNG8→PNG', async () => {
		const FILENAME = 'sample-png8.png';

		const thumbImage = new ThumbImage(OUTPUT_DIR, { fileBasePath: FILENAME, type: 'png', size: { width: 100, height: 200 }, quality: undefined });

		await create(`${INPUT_DIR}/${FILENAME}`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});

	await t.test('PNG32→PNG', async () => {
		const FILENAME = 'sample-png32.png';

		const thumbImage = new ThumbImage(OUTPUT_DIR, { fileBasePath: FILENAME, type: 'png', size: { width: 100, height: 200 }, quality: undefined });

		await create(`${INPUT_DIR}/${FILENAME}`, thumbImage);

		assert.equal(fs.existsSync(thumbImage.fileFullPath), true);
	});
});
