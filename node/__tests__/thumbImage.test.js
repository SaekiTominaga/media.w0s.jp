import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import path from 'node:path';
import ThumbImage from '../dist/util/ThumbImage.js';

process.env.THUMBIMAGE_DIR = 'dir';

test('getter', async (t) => {
	const thumbImage = new ThumbImage({ fileBasePath: 'path/to.jpg', type: 'avif', size: { width: 100, height: 200 }, quality: 80 });

	await t.test('fileBasePath', () => {
		assert.equal(thumbImage.fileBasePath, 'path/to.jpg');
	});

	await t.test('filePath', () => {
		assert.equal(thumbImage.filePath, 'path/to.jpg@s=100x200;q=80.avif');
	});

	await t.test('fileFullPath', () => {
		assert.equal(thumbImage.fileFullPath, path.resolve('dir/path/to.jpg@s=100x200;q=80.avif'));
	});

	await t.test('mime', () => {
		assert.equal(thumbImage.mime, 'image/avif');
	});

	await t.test('altType', () => {
		assert.equal(thumbImage.altType, 'webp');
	});

	await t.test('type', () => {
		assert.equal(thumbImage.type, 'avif');
	});

	await t.test('size.width', () => {
		assert.equal(thumbImage.size.width, 100);
	});

	await t.test('size.height', () => {
		assert.equal(thumbImage.size.height, 200);
	});

	await t.test('quality', () => {
		assert.equal(thumbImage.quality, 80);
	});
});

test('setter', async (t) => {
	const thumbImage = new ThumbImage({ fileBasePath: 'path/to.jpg', type: 'avif', size: { width: 100, height: 200 }, quality: 80 });

	t.beforeEach(() => {
		thumbImage.type = 'webp';
		thumbImage.size = { width: 200, height: 400 };
		thumbImage.quality = 50;
	});

	await t.test('fileBasePath', () => {
		assert.equal(thumbImage.fileBasePath, 'path/to.jpg');
	});

	await t.test('filePath', () => {
		assert.equal(thumbImage.filePath, 'path/to.jpg@s=200x400;q=50.webp');
	});

	await t.test('fileFullPath', () => {
		assert.equal(thumbImage.fileFullPath, path.resolve('dir/path/to.jpg@s=200x400;q=50.webp'));
	});

	await t.test('mime', () => {
		assert.equal(thumbImage.mime, 'image/webp');
	});

	await t.test('altType', () => {
		assert.equal(thumbImage.altType, undefined);
	});

	await t.test('type', () => {
		assert.equal(thumbImage.type, 'webp');
	});

	await t.test('size.width', () => {
		assert.equal(thumbImage.size.width, 200);
	});

	await t.test('size.height', () => {
		assert.equal(thumbImage.size.height, 400);
	});

	await t.test('quality', () => {
		assert.equal(thumbImage.quality, 50);
	});
});

test('filePath', async (t) => {
	const thumbImage = new ThumbImage({ fileBasePath: 'path/to.jpg', type: 'avif', size: { width: 100, height: 200 }, quality: 80 });

	t.beforeEach(() => {
		thumbImage.type = 'avif';
	});

	await t.test('invalid image type', () => {
		thumbImage.type = 'foo';

		assert.throws(
			() => {
				thumbImage.mime;
			},
			{ name: 'Error', message: 'Specified image type information is not registered.' },
		);
	});

	await t.test('quality: true', () => {
		assert.equal(thumbImage.filePath, 'path/to.jpg@s=100x200;q=80.avif');
	});

	await t.test('quality: false', () => {
		thumbImage.type = 'png';
		assert.equal(thumbImage.filePath, 'path/to.jpg@s=100x200.png');
	});
});
