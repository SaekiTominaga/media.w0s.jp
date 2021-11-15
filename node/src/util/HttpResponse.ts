import path from 'path';
import { MediaW0SJp as Configure } from '../../configure/type/common';
import { Request, Response } from 'express';

type HttpAuthType = 'Basic' | 'Bearer' | 'Digest' | 'HOBA' | 'Mutual' | 'Negotiate' | 'OAuth' | 'SCRAM-SHA-1' | 'SCRAM-SHA-256' | 'vapid';

/**
 * HttpResponse
 */
export default class HttpResponse {
	#res: Response;
	#config: Configure;

	/**
	 * @param {Response} res - Request
	 * @param {Configure} config - 共通設定ファイル
	 */
	constructor(res: Response, config: Configure) {
		this.#res = res;
		this.#config = config;
	}

	/**
	 * 最終更新日時を確認する（ドキュメントに変更がなければ 304 を返して終了、変更があれば Last-Modified ヘッダをセットする）
	 *
	 * @param {Request} req - Request
	 * @param {Date} lastModified - 今回のアクセスに対して発行する最終更新日時
	 *
	 * @returns {boolean} ドキュメントに変更がなければ true
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
	 * @param {object} body - Response body
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
	 * @param {string} type - Authentication type <https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml>
	 * @param {string} realm - A description of the protected area.
	 */
	send401Json(type: HttpAuthType, realm: string): void {
		this.#res
			.set('WWW-Authenticate', `${type} realm="${realm}"`)
			.status(401)
			.json(this.#config.auth.json_401);
	}

	/**
	 * 403 Forbidden (HTML)
	 */
	send403(): void {
		this.#res.status(403).sendFile(path.resolve(this.#config.errorpage.path_403));
	}

	/**
	 * 403 Forbidden (Json)
	 *
	 * @param {object} body - Response body
	 */
	send403Json(body?: object): void {
		this.#res.status(403).json(body);
	}

	/**
	 * 404 Not Found (HTML)
	 */
	send404(): void {
		this.#res.status(404).sendFile(path.resolve(this.#config.errorpage.path_404));
	}

	/**
	 * 404 Not Found (Json)
	 *
	 * @param {object} body - Response body
	 */
	send404Json(body?: object): void {
		this.#res.status(404).json(body);
	}
}
