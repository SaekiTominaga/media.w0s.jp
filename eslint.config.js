// @ts-check

import w0sConfig from '@w0s/eslint-config';

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.ConfigArray} */
export default [
	...w0sConfig,
	{
		ignores: ['node/dist/**/*.js'],
	},
	{
		files: ['node/src/validator/*.test.ts'],
		rules: {
			'line-comment-position': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
		},
	},
];
