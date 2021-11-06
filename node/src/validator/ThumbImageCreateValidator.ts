import { NoName as Configure } from '../../configure/type/thumb-image';
import { body, Result, ValidationError, validationResult } from 'express-validator';
import { Request } from 'express';

/**
 * サムネイル画像生成
 */
export default class ThumbImageCreateValidator {
	#req: Request;
	#config: Configure;

	/**
	 * @param {Request} req - Request
	 * @param {Configure} config - 設定ファイル
	 */
	constructor(req: Request, config: Configure) {
		this.#req = req;
		this.#config = config;
	}

	/**
	 * 画像生成
	 *
	 * @returns {Result<ValidationError>} 検証エラー
	 */
	async create(): Promise<Result<ValidationError>> {
		await Promise.all([
			body('type')
				.isIn(Object.keys(this.#config.type))
				.run(this.#req),
			body('width')
				.notEmpty()
				.isInt({ min: 1, max: 9999 })
				.run(this.#req),
			body('height')
				.notEmpty()
				.isInt({ min: 1, max: 9999 })
				.run(this.#req),
			body('quality')
				.optional({ checkFalsy: true })
				.isInt({ min: 1, max: 100 })
				.run(this.#req),
		]);

		return validationResult(this.#req);
	}
}