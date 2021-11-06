import * as sqlite from 'sqlite';
import DbUtil from '../util/DbUtil.js';
import sqlite3 from 'sqlite3';
import { MediaW0SJp as Configure } from '../../configure/type/common';

/**
 * サムネイル画像の画面表示
 */
export default class ThumbImageRenderDao {
	#dbh: sqlite.Database<sqlite3.Database, sqlite3.Statement> | null = null;
	#config: Configure;

	/**
	 * @param {Configure} config - 共通設定
	 * @param {sqlite.Database} dbh - DB 接続情報
	 */
	constructor(config: Configure, dbh?: sqlite.Database<sqlite3.Database, sqlite3.Statement>) {
		this.#config = config;

		if (dbh !== undefined) {
			this.#dbh = dbh;
		}
	}

	/**
	 * DB 接続情報を取得する
	 *
	 * @returns {sqlite.Database} DB 接続情報
	 */
	async getDbh(): Promise<sqlite.Database<sqlite3.Database, sqlite3.Statement>> {
		if (this.#dbh !== null) {
			return this.#dbh;
		}

		const dbh = await sqlite.open({
			filename: this.#config.sqlite.db.thumbimage,
			driver: sqlite3.Database,
		});

		this.#dbh = dbh;

		return dbh;
	}

	/**
	 * 生成する画像情報をキューに登録する
	 *
	 * @param {string} filePath - ファイルパス
	 * @param {string} type - 画像タイプ
	 * @param {number} width - 画像幅
	 * @param {number} height - 画像高さ
	 * @param {number} quality - 画質
	 *
	 * @returns {number} 登録されたデータ数
	 */
	async insert(filePath: string, type: string, width: number, height: number, quality: number | null = null): Promise<number> {
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
			':width': width,
			':height': height,
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
					':width': width,
					':height': height,
					':quality': quality,
					':registered_at': DbUtil.dateToUnix(),
				});
				await sthInsert.finalize();

				insertedCount = result.changes ?? 0;

				dbh.exec('COMMIT');
			} catch (e) {
				dbh.exec('ROLLBACK');
				throw e;
			}
		}

		return insertedCount;
	}
}
