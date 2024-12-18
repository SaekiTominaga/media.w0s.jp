import { body, query, type Result, type ValidationError, validationResult } from 'express-validator';
import type { Request } from 'express';
import config from '../config/thumb-image.js';

/**
 * サムネイル画像
 */
export default class ThumbImageValidator {
	#req: Request;

	/**
	 * @param req - Request
	 */
	constructor(req: Request) {
		this.#req = req;
	}

	/**
	 * 画像表示
	 *
	 * @returns 検証エラー
	 */
	async render(): Promise<Result<ValidationError>> {
		await Promise.all([
			query(typeof this.#req.query['type'] === 'string' ? 'type' : 'type.*')
				.isIn(Object.keys(config.type))
				.run(this.#req),
			query('w').optional({ checkFalsy: true }).isInt({ min: 1, max: 9999 }).run(this.#req),
			query('h').optional({ checkFalsy: true }).isInt({ min: 1, max: 9999 }).run(this.#req),
			query('quality').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }).run(this.#req),
		]);

		return validationResult(this.#req);
	}

	/**
	 * 画像生成
	 *
	 * @returns 検証エラー
	 */
	async create(): Promise<Result<ValidationError>> {
		await Promise.all([
			body('file_path').notEmpty().run(this.#req),
			body('type').isIn(Object.keys(config.type)).run(this.#req),
			body('width').notEmpty().isInt({ min: 1, max: 9999 }).run(this.#req),
			body('height').notEmpty().isInt({ min: 1, max: 9999 }).run(this.#req),
			body('quality').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }).run(this.#req),
		]);

		return validationResult(this.#req);
	}
}
