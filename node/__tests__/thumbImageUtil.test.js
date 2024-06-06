import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import ThumbImageUtil from '../dist/util/ThumbImageUtil.js';

test('getThumbSize()', async (t) => {
	await t.test('幅、高さとも未指定', () => {
		assert.equal(ThumbImageUtil.getThumbSize(null, null, { width: 100, height: 200 }).width, 100);
		assert.equal(ThumbImageUtil.getThumbSize(null, null, { width: 100, height: 200 }).height, 200);
	});

	await t.test('幅のみが指定、縮小しない', () => {
		assert.equal(ThumbImageUtil.getThumbSize(100, null, { width: 100, height: 200 }).width, 100);
		assert.equal(ThumbImageUtil.getThumbSize(100, null, { width: 100, height: 200 }).height, 200);
	});

	await t.test('幅のみが指定、縮小する', () => {
		assert.equal(ThumbImageUtil.getThumbSize(50, null, { width: 100, height: 200 }).width, 50);
		assert.equal(ThumbImageUtil.getThumbSize(50, null, { width: 100, height: 200 }).height, 100);
	});

	await t.test('高さのみが指定、縮小しない', () => {
		assert.equal(ThumbImageUtil.getThumbSize(null, 200, { width: 100, height: 200 }).width, 100);
		assert.equal(ThumbImageUtil.getThumbSize(null, 200, { width: 100, height: 200 }).height, 200);
	});

	await t.test('高さのみが指定、縮小する', () => {
		assert.equal(ThumbImageUtil.getThumbSize(null, 100, { width: 100, height: 200 }).width, 50);
		assert.equal(ThumbImageUtil.getThumbSize(null, 100, { width: 100, height: 200 }).height, 100);
	});

	await t.test('幅、高さが両方指定、縮小しない', () => {
		assert.equal(ThumbImageUtil.getThumbSize(100, 200, { width: 100, height: 200 }).width, 100);
		assert.equal(ThumbImageUtil.getThumbSize(100, 200, { width: 100, height: 200 }).height, 200);
	});

	await t.test('幅、高さが両方指定、幅基準に縮小する', () => {
		assert.equal(ThumbImageUtil.getThumbSize(25, 100, { width: 100, height: 200 }).width, 25);
		assert.equal(ThumbImageUtil.getThumbSize(25, 100, { width: 100, height: 200 }).height, 50);
	});

	await t.test('幅、高さが両方指定、高さ基準に縮小する', () => {
		assert.equal(ThumbImageUtil.getThumbSize(50, 50, { width: 100, height: 200 }).width, 25);
		assert.equal(ThumbImageUtil.getThumbSize(50, 50, { width: 100, height: 200 }).height, 50);
	});
});
