import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';

interface RequestBody {
	filePath: string;
	type: string;
	width: number;
	height: number;
	quality: number | undefined;
}

export const form = validator('form', (value): RequestBody => {
	const { file_path: filePath, type, width, height, quality } = value;

	if (typeof filePath !== 'string') {
		throw new HTTPException(400, { message: 'The `file_path` parameter is invalid' });
	}

	if (typeof type !== 'string') {
		throw new HTTPException(400, { message: 'The `type` parameter is invalid' });
	}

	if (typeof width !== 'string') {
		throw new HTTPException(400, { message: 'The `width` parameter is invalid' });
	}
	if (!/^[0-9]+$/.test(width)) {
		throw new HTTPException(400, { message: 'The value of the `width` parameter must be a positive integer' });
	}
	const widthNumber = Number(width);
	if (widthNumber < 1 || widthNumber > 9999) {
		throw new HTTPException(400, { message: 'The value of the `width` parameter must be between 1 and 9999' });
	}

	if (typeof height !== 'string') {
		throw new HTTPException(400, { message: 'The `height` parameter is invalid' });
	}
	if (!/^[0-9]+$/.test(height)) {
		throw new HTTPException(400, { message: 'The value of the `height` parameter must be a positive integer' });
	}
	const heightNumber = Number(height);
	if (heightNumber < 1 || heightNumber > 9999) {
		throw new HTTPException(400, { message: 'The value of the `height` parameter must be between 1 and 9999' });
	}

	let qualityNumber: number | undefined;
	if (quality !== undefined) {
		if (typeof quality !== 'string') {
			throw new HTTPException(400, { message: 'The `quality` parameter is invalid' });
		}
		if (!/^[0-9]+$/.test(quality)) {
			throw new HTTPException(400, { message: 'The value of the `quality` parameter must be a positive integer' });
		}
		qualityNumber = Number(quality);
		if (qualityNumber < 1 || qualityNumber > 100) {
			throw new HTTPException(400, { message: 'The value of the `quality` parameter must be between 1 and 100' });
		}
	}

	return {
		filePath: filePath,
		type: type,
		width: widthNumber,
		height: heightNumber,
		quality: qualityNumber,
	};
});
