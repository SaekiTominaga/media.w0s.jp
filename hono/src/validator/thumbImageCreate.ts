import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';

interface RequestBody {
	filePath: string;
	type: string;
	width: number;
	height: number;
	quality: number | undefined;
}

export const json = validator('json', (value: Readonly<Record<string, unknown>>): RequestBody => {
	const { path: filePath, type, width, height, quality } = value;

	if (typeof filePath !== 'string') {
		throw new HTTPException(400, { message: 'The `path` parameter is invalid' });
	}

	if (typeof type !== 'string') {
		throw new HTTPException(400, { message: 'The `type` parameter is invalid' });
	}

	if (typeof width !== 'number') {
		throw new HTTPException(400, { message: 'The `width` parameter is invalid' });
	}
	if (width < 1 || width > 9999) {
		throw new HTTPException(400, { message: 'The value of the `width` parameter must be between 1 and 9999' });
	}
	if (!Number.isInteger(width)) {
		throw new HTTPException(400, { message: 'The value of the `width` parameter must be an integer' });
	}

	if (typeof height !== 'number') {
		throw new HTTPException(400, { message: 'The `height` parameter is invalid' });
	}
	if (height < 1 || height > 9999) {
		throw new HTTPException(400, { message: 'The value of the `height` parameter must be between 1 and 9999' });
	}
	if (!Number.isInteger(height)) {
		throw new HTTPException(400, { message: 'The value of the `height` parameter must be an integer' });
	}

	if (quality !== undefined) {
		if (typeof quality !== 'number') {
			throw new HTTPException(400, { message: 'The `quality` parameter is invalid' });
		}
		if (quality < 1 || quality > 100) {
			throw new HTTPException(400, { message: 'The value of the `quality` parameter must be between 1 and 100' });
		}
		if (!Number.isInteger(quality)) {
			throw new HTTPException(400, { message: 'The value of the `quality` parameter must be an integer' });
		}
	}

	return {
		filePath: filePath,
		type: type,
		width: width,
		height: height,
		quality: quality,
	};
});
