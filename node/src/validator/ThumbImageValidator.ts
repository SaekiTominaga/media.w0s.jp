import { query, ValidationChain } from 'express-validator';

/**
 * サムネイル画像
 */
export default class ThumbImageValidator {
	validate(): ValidationChain[] {
		return [
			query('type').isIn(['webp', 'avif', 'jpeg']),
			query('w').isInt({ min: 1, max: 9999 }),
			query('mh').optional({ checkFalsy: true }).isInt({ min: 1, max: 9999 }),
			query('quality').isInt({ min: 0, max: 100 }),
		];
	}
}
