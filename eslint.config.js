// @ts-check

import w0sConfig from '@w0s/eslint-config';

/** @type {import("eslint").Linter.Config[]} */
export default [
	...w0sConfig,
	{
		ignores: ['@types', 'hono/dist'],
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
		files: ['hono/src/**/*.test.ts'],
		rules: {
			'line-comment-position': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
		},
	},
	{
		files: ['hono/src/controller/*.ts', 'hono/src/app.test.ts'],
		rules: {
			'@typescript-eslint/await-thenable': 'off',
		},
	},
	{
		files: ['hono/src/util/**/*.ts'],
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
