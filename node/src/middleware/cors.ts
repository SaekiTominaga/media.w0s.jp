import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

export const cors = createMiddleware(async (context, next) => {
	const { req, res } = context;

	if (req.header('Origin') !== undefined) {
		if (res.headers.get('Access-Control-Allow-Origin') === null) {
			throw new HTTPException(403, { message: 'Access from an unauthorized origin' });
		}
	}

	await next();
});
