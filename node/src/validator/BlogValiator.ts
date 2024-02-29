import { body, type Result, type ValidationError, validationResult } from 'express-validator';
import type { Request } from 'express';

/**
 * ブログ
 */
export default class BlogValidator {
	#req: Request;

	/**
	 * @param req - Request
	 */
	constructor(req: Request) {
		this.#req = req;
	}

	/**
	 * ファイルアップロード
	 *
	 * @returns 検証エラー
	 */
	async upload(): Promise<Result<ValidationError>> {
		await Promise.all([
			body('name').notEmpty().run(this.#req),
			body('type').notEmpty().run(this.#req),
			body('temppath').notEmpty().run(this.#req),
			body('size').notEmpty().isInt({ min: 0 }).run(this.#req),
		]);

		return validationResult(this.#req);
	}
}
