/* eslint-disable no-unused-expressions */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-named-as-default */
/* eslint-disable import/no-named-as-default-member */
import path from 'path';
import { describe, expect, test, beforeEach } from '@jest/globals';
import ThumbImage from '../dist/util/ThumbImage.js';

const TYPE = {
	avif: {
		mime: 'image/avif',
		extension: 'avif',
		quality: true,
		alt_type: 'webp',
	},
	webp: {
		mime: 'image/webp',
		extension: 'webp',
		quality: true,
	},
	jpeg: {
		mime: 'image/jpeg',
		extension: 'jpeg',
		quality: true,
	},
	png: {
		mime: 'image/png',
		extension: 'png',
		quality: false,
	},
};

describe('getter', () => {
	const thumbImage = new ThumbImage(TYPE, 'dir', 'path/to.jpg', 'avif', { width: 100, height: 200 }, 80);

	test('fileBasePath', () => {
		expect(thumbImage.fileBasePath).toBe('path/to.jpg');
	});

	test('filePath', () => {
		expect(thumbImage.filePath).toBe('path/to.jpg@s=100x200;q=80.avif');
	});

	test('fileFullPath', () => {
		expect(thumbImage.fileFullPath).toBe(path.resolve('dir/path/to.jpg@s=100x200;q=80.avif'));
	});

	test('mime', () => {
		expect(thumbImage.mime).toBe('image/avif');
	});

	test('altType', () => {
		expect(thumbImage.altType).toBe('webp');
	});

	test('type', () => {
		expect(thumbImage.type).toBe('avif');
	});

	test('size.width', () => {
		expect(thumbImage.size.width).toBe(100);
	});

	test('size.height', () => {
		expect(thumbImage.size.height).toBe(200);
	});

	test('quality', () => {
		expect(thumbImage.quality).toBe(80);
	});
});

describe('setter', () => {
	const thumbImage = new ThumbImage(TYPE, 'dir', 'path/to.jpg', 'avif', { width: 100, height: 200 }, 80);

	beforeEach(() => {
		thumbImage.type = 'webp';
		thumbImage.size = { width: 200, height: 400 };
		thumbImage.quality = 50;
	});

	test('fileBasePath', () => {
		expect(thumbImage.fileBasePath).toBe('path/to.jpg');
	});

	test('filePath', () => {
		expect(thumbImage.filePath).toBe('path/to.jpg@s=200x400;q=50.webp');
	});

	test('fileFullPath', () => {
		expect(thumbImage.fileFullPath).toBe(path.resolve('dir/path/to.jpg@s=200x400;q=50.webp'));
	});

	test('mime', () => {
		expect(thumbImage.mime).toBe('image/webp');
	});

	test('altType', () => {
		expect(thumbImage.altType).toBeUndefined();
	});

	test('type', () => {
		expect(thumbImage.type).toBe('webp');
	});

	test('size.width', () => {
		expect(thumbImage.size.width).toBe(200);
	});

	test('size.height', () => {
		expect(thumbImage.size.height).toBe(400);
	});

	test('quality', () => {
		expect(thumbImage.quality).toBe(50);
	});
});

describe('filePath', () => {
	const thumbImage = new ThumbImage(TYPE, 'dir', 'path/to.jpg', 'avif', { width: 100, height: 200 }, 80);

	beforeEach(() => {
		thumbImage.type = 'avif';
	});

	test('invalid image type', () => {
		thumbImage.type = 'foo';
		expect(() => {
			thumbImage.mime;
		}).toThrow('Specified image type information is not registered.');
	});

	test('quality: true', () => {
		expect(thumbImage.filePath).toBe('path/to.jpg@s=100x200;q=80.avif');
	});

	test('quality: false', () => {
		thumbImage.type = 'png';
		expect(thumbImage.filePath).toBe('path/to.jpg@s=100x200.png');
	});
});
