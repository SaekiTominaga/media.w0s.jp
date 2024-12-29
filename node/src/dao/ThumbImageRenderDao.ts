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
	async insert(data: { filePath: string; type: string; size: ImageSize; quality: number | undefined }): Promise<number> {
		interface Select {
			count: number;
		}

		const dbh = await this.#getDbh();

		let sthSelect: sqlite.Statement;
		if (data.quality !== undefined) {
			sthSelect = await dbh.prepare(`
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
				':file_path': data.filePath,
				':type': data.type,
				':width': data.size.width,
				':height': data.size.height,
				':quality': data.quality,
			});
		} else {
			sthSelect = await dbh.prepare(`
				SELECT
					COUNT(file_path) AS count
				FROM
					d_queue
				WHERE
					file_path = :file_path AND
					file_type = :type AND
					width = :width AND
					height = :height AND
					quality IS NULL
			`);
			await sthSelect.bind({
				':file_path': data.filePath,
				':type': data.type,
				':width': data.size.width,
				':height': data.size.height,
			});
		}
		const row = await sthSelect.get<Select>();
		await sthSelect.finalize();

		if (row === undefined || row.count > 0 /* 既にキューにある場合 */) {
			return 0;
		}

		let insertedCount = 0; // 登録されたデータ数

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
				':file_path': data.filePath,
				':type': data.type,
				':width': data.size.width,
				':height': data.size.height,
				':quality': data.quality,
				':registered_at': Math.round(Date.now() / 1000),
			});
			await sthInsert.finalize();

			insertedCount = result.changes ?? 0;

			await dbh.exec('COMMIT');
		} catch (e) {
			await dbh.exec('ROLLBACK');
			throw e;
		}

		return insertedCount;
	}
}
