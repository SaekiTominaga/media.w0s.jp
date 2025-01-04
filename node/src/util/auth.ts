import fs from 'node:fs';

interface Auth {
	user: string;
	password: string;
	password_orig?: string;
	realm: string;
}

/**
 * 認証ファイルを読み取る
 *
 * @returns 認証ファイルの内容
 */
export const getAuth = async (): Promise<Auth> => {
	const filePath = process.env['AUTH_ADMIN'];
	if (filePath === undefined) {
		throw new Error('Auth file not defined');
	}

	return JSON.parse((await fs.promises.readFile(filePath)).toString()) as Auth;
};
