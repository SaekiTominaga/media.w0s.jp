// @ts-check

import tseslint from 'typescript-eslint';
import w0sConfig from '@w0s/eslint-config';

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.ConfigArray} */
export default tseslint.config(
	...w0sConfig,
	{
		files: ['node/src/app.ts'],
		rules: {
			'@typescript-eslint/no-misused-promises': 'off',
		},
	},
	{
		files: ['node/src/*Interface.ts'],
		rules: {
			semi: 'off',
		},
	},
);
