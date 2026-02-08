import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';

interface RequestBody {
	fileName: string;
	type: string;
	tempPath: string;
	size: number;
	overwrite: boolean;
}

export const json = validator('json', (value: Readonly<Record<string, unknown>>): RequestBody => {
	const { name: fileName, type, temp: tempPath, size, overwrite } = value;

	if (typeof fileName !== 'string') {
		throw new HTTPException(400, { message: 'The `name` parameter is invalid' });
	}

	if (typeof type !== 'string') {
		throw new HTTPException(400, { message: 'The `type` parameter is invalid' });
	}

	if (typeof tempPath !== 'string') {
		throw new HTTPException(400, { message: 'The `temp` parameter is invalid' });
	}

	if (typeof size !== 'number') {
		throw new HTTPException(400, { message: 'The `size` parameter is invalid' });
	}
	if (size < 0 || !Number.isFinite(size) || !Number.isInteger(size)) {
		throw new HTTPException(400, { message: 'The value of the `size` parameter must be a positive integer' });
	}

	if (overwrite !== undefined) {
		if (typeof overwrite !== 'boolean') {
			throw new HTTPException(400, { message: 'The `overwrite` parameter is invalid' });
		}
	}

	return {
		fileName: fileName,
		type: type,
		tempPath: tempPath,
		size: size,
		overwrite: overwrite ?? false,
	};
});
