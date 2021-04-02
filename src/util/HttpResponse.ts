import { Request, Response } from 'express';

/**
 * HttpResponse
 */
export default class HttpResponse {
	#res: Response;

	constructor(res: Response) {
		this.#res = res;
	}

	/**
	 * 最終更新日時を確認する（ドキュメントに変更がなければ 304 を返して終了、変更があれば Last-Modified ヘッダをセットする）
	 *
	 * @param {Request} req - Request
	 * @param {Date} lastModified - 今回のアクセスに対して発行する最終更新日時
	 */
	checkLastModified(req: Request, lastModified: Date): void {
		const ifModifiedSince = req.get('If-Modified-Since');
		if (ifModifiedSince !== undefined) {
			if (lastModified <= new Date(ifModifiedSince)) {
				this.#res.status(304);
			}
		}

		this.#res.set('Last-Modified', lastModified.toUTCString());
	}
}
