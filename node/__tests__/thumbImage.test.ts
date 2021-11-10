import path from 'path';
import ThumbImage from '../src/util/ThumbImage';
import { NoName2 as ImageInfos } from '../configure/type/thumb-image';

describe('ThumbImage', () => {
	const TYPE: ImageInfos = {
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

	test('AVIF', () => {
		const thumbImage = new ThumbImage(TYPE, 'dir', 'path/to.jpg', 'avif', { width: 100, height: 200 }, 80);

		expect(thumbImage.fileBasePath).toBe('path/to.jpg');
		expect(thumbImage.filePath).toBe('path/to.jpg@s=100x200;q=80.avif');
		expect(thumbImage.fileFullPath).toBe(path.resolve('dir/path/to.jpg@s=100x200;q=80.avif'));
		expect(thumbImage.mime).toBe('image/avif');
		expect(thumbImage.altType).toBe('webp');
		expect(thumbImage.type).toBe('avif');
		expect(thumbImage.size.width).toBe(100);
		expect(thumbImage.size.height).toBe(200);
		expect(thumbImage.quality).toBe(80);
	});
	test('PNG', () => {
		const thumbImage = new ThumbImage(TYPE, 'dir', 'path/to.jpg', 'png', { width: 100, height: 200 });

		expect(thumbImage.fileBasePath).toBe('path/to.jpg');
		expect(thumbImage.filePath).toBe('path/to.jpg@s=100x200.png');
		expect(thumbImage.fileFullPath).toBe(path.resolve('dir/path/to.jpg@s=100x200.png'));
		expect(thumbImage.mime).toBe('image/png');
		expect(thumbImage.altType).toBeUndefined();
		expect(thumbImage.type).toBe('png');
		expect(thumbImage.size.width).toBe(100);
		expect(thumbImage.size.height).toBe(200);
		expect(thumbImage.quality).toBeUndefined();
	});
	test('setter', () => {
		const thumbImage = new ThumbImage(TYPE, 'dir', 'path/to.jpg', 'avif', { width: 100, height: 200 }, 80);
		thumbImage.type = 'jpeg';
		thumbImage.size = { width: 200, height: 400 };
		thumbImage.quality = 50;

		expect(thumbImage.fileBasePath).toBe('path/to.jpg');
		expect(thumbImage.filePath).toBe('path/to.jpg@s=200x400;q=50.jpeg');
		expect(thumbImage.fileFullPath).toBe(path.resolve('dir/path/to.jpg@s=200x400;q=50.jpeg'));
		expect(thumbImage.mime).toBe('image/jpeg');
		expect(thumbImage.altType).toBeUndefined();
		expect(thumbImage.type).toBe('jpeg');
		expect(thumbImage.size.width).toBe(200);
		expect(thumbImage.size.height).toBe(400);
		expect(thumbImage.quality).toBe(50);
	});
});
