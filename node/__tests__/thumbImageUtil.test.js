import { describe, expect, test } from '@jest/globals';
import ThumbImageUtil from '../dist/util/ThumbImageUtil.js';

describe('getThumbSize()', () => {
	test('幅、高さとも未指定', () => {
		expect(ThumbImageUtil.getThumbSize(null, null, { width: 100, height: 200 }).width).toBe(100);
		expect(ThumbImageUtil.getThumbSize(null, null, { width: 100, height: 200 }).height).toBe(200);
	});

	test('幅のみが指定、縮小しない', () => {
		expect(ThumbImageUtil.getThumbSize(100, null, { width: 100, height: 200 }).width).toBe(100);
		expect(ThumbImageUtil.getThumbSize(100, null, { width: 100, height: 200 }).height).toBe(200);
	});

	test('幅のみが指定、縮小する', () => {
		expect(ThumbImageUtil.getThumbSize(50, null, { width: 100, height: 200 }).width).toBe(50);
		expect(ThumbImageUtil.getThumbSize(50, null, { width: 100, height: 200 }).height).toBe(100);
	});

	test('高さのみが指定、縮小しない', () => {
		expect(ThumbImageUtil.getThumbSize(null, 200, { width: 100, height: 200 }).width).toBe(100);
		expect(ThumbImageUtil.getThumbSize(null, 200, { width: 100, height: 200 }).height).toBe(200);
	});

	test('高さのみが指定、縮小する', () => {
		expect(ThumbImageUtil.getThumbSize(null, 100, { width: 100, height: 200 }).width).toBe(50);
		expect(ThumbImageUtil.getThumbSize(null, 100, { width: 100, height: 200 }).height).toBe(100);
	});

	test('幅、高さが両方指定、縮小しない', () => {
		expect(ThumbImageUtil.getThumbSize(100, 200, { width: 100, height: 200 }).width).toBe(100);
		expect(ThumbImageUtil.getThumbSize(100, 200, { width: 100, height: 200 }).height).toBe(200);
	});

	test('幅、高さが両方指定、幅基準に縮小する', () => {
		expect(ThumbImageUtil.getThumbSize(25, 100, { width: 100, height: 200 }).width).toBe(25);
		expect(ThumbImageUtil.getThumbSize(25, 100, { width: 100, height: 200 }).height).toBe(50);
	});

	test('幅、高さが両方指定、高さ基準に縮小する', () => {
		expect(ThumbImageUtil.getThumbSize(50, 50, { width: 100, height: 200 }).width).toBe(25);
		expect(ThumbImageUtil.getThumbSize(50, 50, { width: 100, height: 200 }).height).toBe(50);
	});
});
