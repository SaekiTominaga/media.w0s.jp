import ThumbImage from '../src/util/ThumbImage';

describe('getThumbSize()', () => {
	test('幅、高さとも未指定', () => {
		expect(ThumbImage.getThumbSize(null, null, { width: 100, height: 200 }).width).toBe(100);
		expect(ThumbImage.getThumbSize(null, null, { width: 100, height: 200 }).height).toBe(200);
	});
	test('幅のみが指定、縮小しない', () => {
		expect(ThumbImage.getThumbSize(100, null, { width: 100, height: 200 }).width).toBe(100);
		expect(ThumbImage.getThumbSize(100, null, { width: 100, height: 200 }).height).toBe(200);
	});
	test('幅のみが指定、縮小する', () => {
		expect(ThumbImage.getThumbSize(50, null, { width: 100, height: 200 }).width).toBe(50);
		expect(ThumbImage.getThumbSize(50, null, { width: 100, height: 200 }).height).toBe(100);
	});
	test('高さのみが指定、縮小しない', () => {
		expect(ThumbImage.getThumbSize(null, 200, { width: 100, height: 200 }).width).toBe(100);
		expect(ThumbImage.getThumbSize(null, 200, { width: 100, height: 200 }).height).toBe(200);
	});
	test('高さのみが指定、縮小する', () => {
		expect(ThumbImage.getThumbSize(null, 100, { width: 100, height: 200 }).width).toBe(50);
		expect(ThumbImage.getThumbSize(null, 100, { width: 100, height: 200 }).height).toBe(100);
	});
	test('幅、高さが両方指定、縮小しない', () => {
		expect(ThumbImage.getThumbSize(100, 200, { width: 100, height: 200 }).width).toBe(100);
		expect(ThumbImage.getThumbSize(100, 200, { width: 100, height: 200 }).height).toBe(200);
	});
	test('幅、高さが両方指定、幅基準に縮小する', () => {
		expect(ThumbImage.getThumbSize(25, 100, { width: 100, height: 200 }).width).toBe(25);
		expect(ThumbImage.getThumbSize(25, 100, { width: 100, height: 200 }).height).toBe(50);
	});
	test('幅、高さが両方指定、高さ基準に縮小する', () => {
		expect(ThumbImage.getThumbSize(50, 50, { width: 100, height: 200 }).width).toBe(25);
		expect(ThumbImage.getThumbSize(50, 50, { width: 100, height: 200 }).height).toBe(50);
	});
});

describe('getThumbFileName()', () => {
	const TYPE = {
		avif: {
			mime: 'image/avif',
			extension: 'avif',
			quality: true,
		},
		webp: {
			mime: 'image/webp',
			extension: 'webp',
			quality: true,
		},
		png: {
			mime: 'image/png',
			extension: 'png',
			quality: false,
		},
		jpeg: {
			mime: 'image/jpeg',
			extension: 'jpeg',
			quality: true,
		},
	};

	test('PNG以外', () => {
		expect(ThumbImage.getThumbFileName('path/to.jpg', 'webp', 80, { width: 100, height: 200 }, TYPE)).toBe('path/to.jpg@s=100x200;q=80.webp');
	});
	test('PNG', () => {
		expect(ThumbImage.getThumbFileName('path/to.jpg', 'png', 80, { width: 100, height: 200 }, TYPE)).toBe('path/to.jpg@s=100x200.png');
	});
});
