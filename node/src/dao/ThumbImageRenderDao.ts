import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import { prepareInsert } from '../util/sql.js';

/**
 * サムネイル画像の画面表示
 */
export default class ThumbImageRenderDao {
	#dbh: sqlite.Database | null = null;

	readonly #filepath: string;

	/**
	 * @param filepath - DB ファイルパス
	 * @param dbh - DB 接続情報
	 */
	constructor(filepath: string, dbh?: sqlite.Database) {
		this.#filepath = filepath;

		if (dbh !== undefined) {
			this.#dbh = dbh;
		}
	}

	/**
	 * DB 接続情報を取得する
	 *
	 * @returns DB 接続情報
	 */
	async #getDbh(): Promise<sqlite.Database> {
		if (this.#dbh !== null) {
			return this.#dbh;
		}

		const dbh = await sqlite.open({
			filename: this.#filepath,
			driver: sqlite3.Database,
		});

		this.#dbh = dbh;

		return dbh;
	}

	/**
	 * 生成する画像情報をキューに登録する
	 *
	 * @param data - 登録データ
	 *
	 * @returns 登録されたデータ数
	 */
	async insert(data: Readonly<Omit<ThumbImageDB.Queue, 'registeredAt'>>): Promise<number> {
		const dbh = await this.#getDbh();

		let insertedCount: number; // 登録されたデータ数

		await dbh.exec('BEGIN');
		try {
			const { sqlInto, sqlValues, bindParams } = prepareInsert({
				file_path: data.filePath,
				file_type: data.type,
				width: data.width,
				height: data.height,
				quality: data.quality,
				registered_at: new Date(),
			});

			const sth = await dbh.prepare(`
				INSERT INTO
					d_queue
					${sqlInto}
				VALUES
					${sqlValues}
			`);
			const result = await sth.run(bindParams);
			await sth.finalize();

			insertedCount = result.changes ?? 0;

			await dbh.exec('COMMIT');
		} catch (e) {
			await dbh.exec('ROLLBACK');
			throw e;
		}

		return insertedCount;
	}
}
