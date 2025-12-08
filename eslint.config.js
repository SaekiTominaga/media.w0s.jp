// @ts-check

import w0sConfig from '@w0s/eslint-config';

/** @type {import("eslint").Linter.Config[]} */
export default [
	...w0sConfig,
	{
		ignores: ['node/dist'],
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ['node/src/**/*.test.ts'],
		rules: {
			'line-comment-position': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
		},
	},
	{
		files: ['node/src/controller/*.ts', 'node/src/app.test.ts'],
		rules: {
			'@typescript-eslint/await-thenable': 'off',
		},
	},
	{
		files: ['node/src/util/**/*.ts'],
		rules: {
			'func-style': [
				'error',
				'expression',
				{
					overrides: {
						namedExports: 'ignore',
					},
				},
			],
		},
	},
];
