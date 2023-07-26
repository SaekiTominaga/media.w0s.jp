import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import DbUtil from '../util/DbUtil.js';

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
	async getDbh(): Promise<sqlite.Database> {
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
	 * @param filePath - ファイルパス
	 * @param type - 画像タイプ
	 * @param size - 画像の大きさ
	 * @param quality - 画質
	 *
	 * @returns 登録されたデータ数
	 */
	async insert(filePath: string, type: string, size: ImageSize, quality: number | null = null): Promise<number> {
		const dbh = await this.getDbh();

		const sthSelect = await dbh.prepare(`
			SELECT
				COUNT(file_path) AS count
			FROM
				d_queue
			WHERE
				file_path = :file_path AND
				file_type = :type AND
				width = :width AND
				height = :height AND
				quality = :quality
		`);
		await sthSelect.bind({
			':file_path': filePath,
			':type': type,
			':width': size.width,
			':height': size.height,
			':quality': quality,
		});
		const row = await sthSelect.get();
		await sthSelect.finalize();

		let insertedCount = 0; // 登録されたデータ数
		if (row.count === 0) {
			await dbh.exec('BEGIN');
			try {
				const sthInsert = await dbh.prepare(`
					INSERT INTO
						d_queue
						(file_path, file_type, width, height, quality, registered_at)
					VALUES
						(:file_path, :type, :width, :height, :quality, :registered_at)
				`);
				const result = await sthInsert.run({
					':file_path': filePath,
					':type': type,
					':width': size.width,
					':height': size.height,
					':quality': quality,
					':registered_at': DbUtil.dateToUnix(),
				});
				await sthInsert.finalize();

				insertedCount = result.changes ?? 0;

				await dbh.exec('COMMIT');
			} catch (e) {
				await dbh.exec('ROLLBACK');
				throw e;
			}
		}

		return insertedCount;
	}
}
