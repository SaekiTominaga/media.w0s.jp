import { Request, Response } from 'express';

/**
 * HttpResponse
 */
export default class HttpResponse {
	#req: Request;
	#res: Response;

	constructor(req: Request, res: Response) {
		this.#req = req;
		this.#res = res;
	}

	/**
	 * 最終更新日時を確認する（ドキュメントに変更がなければ 304 を返して終了、変更があれば Last-Modified ヘッダをセットする）
	 *
	 * @param {Date} lastModified - 今回のアクセスに対して発行する最終更新日時
	 */
	checkLastModified(lastModified: Date): void {
		const ifModifiedSince = this.#req.get('If-Modified-Since');
		if (ifModifiedSince !== undefined) {
			if (lastModified <= new Date(ifModifiedSince)) {
				this.#res.status(304);
			}
		}

		this.#res.set('Last-Modified', lastModified.toUTCString());
	}
}
