import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';

interface RequestBody {
	name: string;
	type: string;
	temppath: string;
	size: number;
	overwrite: boolean;
}

export const form = validator('form', (value): RequestBody => {
	const { name, type, temppath, size, overwrite } = value;

	if (typeof name !== 'string') {
		throw new HTTPException(400, { message: 'The `name` parameter is invalid' });
	}

	if (typeof type !== 'string') {
		throw new HTTPException(400, { message: 'The `type` parameter is invalid' });
	}

	if (typeof temppath !== 'string') {
		throw new HTTPException(400, { message: 'The `temppath` parameter is invalid' });
	}

	if (typeof size !== 'string') {
		throw new HTTPException(400, { message: 'The `size` parameter is invalid' });
	}
	if (!/^[0-9]+$/.test(size)) {
		throw new HTTPException(400, { message: 'The value of the `size` parameter must be a positive integer' });
	}
	const sizeNumber = Number(size);

	if (overwrite !== undefined) {
		if (typeof overwrite !== 'string') {
			throw new HTTPException(400, { message: 'The `overwrite` parameter is invalid' });
		}
	}

	return {
		name: name,
		type: type,
		temppath: temppath,
		size: sizeNumber,
		overwrite: Boolean(overwrite),
	};
});
