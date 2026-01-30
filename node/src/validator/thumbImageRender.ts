import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import config from '../config/thumb-image.ts';

interface RequestBody {
	type: string;
	w: number | undefined;
	h: number | undefined;
	quality: number | undefined;
}

export const query = validator('query', (value): RequestBody => {
	const { type, w, h, quality } = value;

	if (type === undefined) {
		throw new HTTPException(400, { message: 'The `type` parameter is required' });
	}
	if (typeof type === 'object') {
		throw new HTTPException(400, { message: 'The `type` parameter can only be singular' });
	}
	if (!Object.keys(config.type).includes(type)) {
		throw new HTTPException(400, { message: 'The value of the `type` parameter is not an accepted string' });
	}

	let wNumber: number | undefined;
	if (w !== undefined) {
		if (typeof w === 'object') {
			throw new HTTPException(400, { message: 'The `w` parameter can only be singular' });
		}

		wNumber = Number(w);

		if (wNumber < 1 || wNumber > 9999) {
			throw new HTTPException(400, { message: 'The value of the `w` parameter must be between 1 and 9999' });
		}
		if (!Number.isInteger(wNumber)) {
			throw new HTTPException(400, { message: 'The value of the `w` parameter must be an integer' });
		}
	}

	let hNumber: number | undefined;
	if (h !== undefined) {
		if (typeof h === 'object') {
			throw new HTTPException(400, { message: 'The `h` parameter can only be singular' });
		}

		hNumber = Number(h);

		if (hNumber < 1 || hNumber > 9999) {
			throw new HTTPException(400, { message: 'The value of the `h` parameter must be between 1 and 9999' });
		}
		if (!Number.isInteger(hNumber)) {
			throw new HTTPException(400, { message: 'The value of the `h` parameter must be an integer' });
		}
	}

	let qualityNumber: number | undefined;
	if (quality !== undefined) {
		if (typeof quality === 'object') {
			throw new HTTPException(400, { message: 'The `quality` parameter can only be singular' });
		}

		qualityNumber = Number(quality);

		if (qualityNumber < 1 || qualityNumber > 100) {
			throw new HTTPException(400, { message: 'The value of the `quality` parameter must be between 1 and 100' });
		}
		if (!Number.isInteger(qualityNumber)) {
			throw new HTTPException(400, { message: 'The value of the `quality` parameter must be an integer' });
		}
	}

	return {
		type,
		w: wNumber,
		h: hNumber,
		quality: qualityNumber,
	};
});
