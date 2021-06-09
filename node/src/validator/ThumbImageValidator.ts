import { NoName as Configure } from '../../configure/type/thumb-image';
import { query, Result, ValidationError, validationResult } from 'express-validator';
import { Request } from 'express';

/**
 * サムネイル画像
 */
export default class ThumbImageValidator {
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
	 * 画像表示
	 *
	 * @returns {Result<ValidationError>} 検証エラー
	 */
	async display(): Promise<Result<ValidationError>> {
		await query('type')
			.isIn(Object.keys(this.#config.extension))
			.run(this.#req);
		await query('w')
			.isInt({ min: 1, max: 9999 })
			.run(this.#req);
		await query('mh')
			.optional({ checkFalsy: true })
			.isInt({ min: 1, max: 9999 })
			.run(this.#req);
		await query('quality')
			.isInt({ min: 0, max: 100 })
			.run(this.#req);

		return validationResult(this.#req);
	}
}
