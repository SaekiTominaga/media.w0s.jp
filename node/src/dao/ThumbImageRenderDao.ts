import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';

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
	 * @param data.filePath - ファイルパス
	 * @param data.type - 画像タイプ
	 * @param data.size - 画像の大きさ
	 * @param data.quality - 画質
	 *
	 * @returns 登録されたデータ数
	 */
	async insert(data: Readonly<Omit<ThumbImageDB.Queue, 'registeredAt'>>): Promise<number> {
		const dbh = await this.#getDbh();

		let insertedCount: number; // 登録されたデータ数

		await dbh.exec('BEGIN');
		try {
			const sth = await dbh.prepare(`
				INSERT INTO
					d_queue
					(file_path,  file_type, width,  height,  quality,  registered_at)
				VALUES
					(:file_path, :type,    :width, :height, :quality, :registered_at)
			`);
			const result = await sth.run({
				':file_path': data.filePath,
				':type': data.type,
				':width': data.width,
				':height': data.height,
				':quality': data.quality,
				':registered_at': Math.round(Date.now() / 1000),
			});
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
