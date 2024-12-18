import path from 'node:path';
import type { Request, Response } from 'express';

type HttpAuthType = 'Basic' | 'Bearer' | 'Digest' | 'HOBA' | 'Mutual' | 'Negotiate' | 'OAuth' | 'SCRAM-SHA-1' | 'SCRAM-SHA-256' | 'vapid';

/**
 * HttpResponse
 */
export default class HttpResponse {
	#res: Response;

	/**
	 * @param res - Request
	 */
	constructor(res: Response) {
		this.#res = res;
	}

	/**
	 * 最終更新日時を確認する（ドキュメントに変更がなければ 304 を返して終了、変更があれば Last-Modified ヘッダをセットする）
	 *
	 * @param req - Request
	 * @param lastModified - 今回のアクセスに対して発行する最終更新日時
	 *
	 * @returns ドキュメントに変更がなければ true
	 */
	checkLastModified(req: Request, lastModified: Date): boolean {
		const ifModifiedSince = req.get('If-Modified-Since');
		if (ifModifiedSince !== undefined) {
			if (Math.floor(lastModified.getTime() / 1000) <= Math.floor(new Date(ifModifiedSince).getTime() / 1000)) {
				this.#res.status(304).end();
				return true;
			}
		}

		this.#res.set('Last-Modified', lastModified.toUTCString());
		return false;
	}

	/**
	 * 200 OK (Json)
	 *
	 * @param body - Response body
	 */
	send200Json(body: object): void {
		this.#res.status(200).json(body);
	}

	/**
	 * 204 No Content
	 */
	send204(): void {
		this.#res.status(204).end();
	}

	/**
	 * 401 Unauthorized (Json)
	 *
	 * @param type - Authentication type <https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml>
	 * @param realm - A description of the protected area.
	 */
	send401Json(type: HttpAuthType, realm: string): void {
		this.#res.set('WWW-Authenticate', `${type} realm="${realm}"`).status(401).json({
			message: '401 Unauthorized',
		});
	}

	/**
	 * 403 Forbidden (HTML)
	 */
	send403(): void {
		const pagePath = process.env['ERRORPAGE_403'];
		if (pagePath === undefined) {
			throw new Error("403 page's file path not defined");
		}
		this.#res.status(403).sendFile(path.resolve(pagePath));
	}

	/**
	 * 403 Forbidden (Json)
	 *
	 * @param body - Response body
	 */
	send403Json(body?: object): void {
		this.#res.status(403).json(body);
	}

	/**
	 * 404 Not Found (HTML)
	 */
	send404(): void {
		const pagePath = process.env['ERRORPAGE_404'];
		if (pagePath === undefined) {
			throw new Error("404 page's file path not defined");
		}
		this.#res.status(404).sendFile(path.resolve(pagePath));
	}

	/**
	 * 404 Not Found (Json)
	 *
	 * @param body - Response body
	 */
	send404Json(body?: object): void {
		this.#res.status(404).json(body);
	}
}
