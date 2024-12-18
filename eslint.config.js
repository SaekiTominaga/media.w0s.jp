// @ts-check

import w0sConfig from '@w0s/eslint-config';

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.ConfigArray} */
export default [
	...w0sConfig,
	{
		ignores: ['node/dist/**/*.js'],
	},
	{
		files: ['node/__tests__/**/*.test.js'],
		rules: {
			'import/no-unresolved': 'off', // Github Actions 環境では /dist/ ファイルが存在しないためテスト不可
		},
	},
	{
		files: ['node/src/controller/**/*.ts'],
		rules: {
			'class-methods-use-this': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
		},
	},
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
];
