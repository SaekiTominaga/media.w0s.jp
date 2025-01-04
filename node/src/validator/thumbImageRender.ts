import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import config from '../config/thumb-image.js';

interface RequestBody {
	type: string;
	w: number | undefined;
	h: number | undefined;
	quality: number | undefined;
}

export const query = validator('query', (value, context): RequestBody => {
	const { req, res } = context;
	const { type, w, h, quality } = value;

	if (req.header('Origin') !== undefined) {
		/* クロスオリジンからの `<img crossorigin>` による呼び出し */
		if (res.headers.get('Access-Control-Allow-Origin') === null) {
			throw new HTTPException(403, { message: '`Access-Control-Allow-Origin` header does not exist' });
		}
	}

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

		if (!/^[0-9]+$/.test(w)) {
			throw new HTTPException(400, { message: 'The value of the `w` parameter must be a positive integer' });
		}

		wNumber = Number(w);
		if (wNumber < 1 || wNumber > 9999) {
			throw new HTTPException(400, { message: 'The value of the `w` parameter must be between 1 and 9999' });
		}
	}

	let hNumber: number | undefined;
	if (h !== undefined) {
		if (typeof h === 'object') {
			throw new HTTPException(400, { message: 'The `h` parameter can only be singular' });
		}

		if (!/^[0-9]+$/.test(h)) {
			throw new HTTPException(400, { message: 'The value of the `h` parameter must be a positive integer' });
		}

		hNumber = Number(h);
		if (hNumber < 1 || hNumber > 9999) {
			throw new HTTPException(400, { message: 'The value of the `h` parameter must be between 1 and 9999' });
		}
	}

	let qualityNumber: number | undefined;
	if (quality !== undefined) {
		if (typeof quality === 'object') {
			throw new HTTPException(400, { message: 'The `quality` parameter can only be singular' });
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
		type,
		w: wNumber,
		h: hNumber,
		quality: qualityNumber,
	};
});
