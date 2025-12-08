import type { Insertable } from 'kysely';
import { jsToSQLiteAssignment } from '@w0s/sqlite-utility';
import type { DQueue } from '../../../@types/db_thumbimage.ts';
import Database from './Database.ts';

/**
 * サムネイル画像の画面表示
 */
export default class extends Database {
	/**
	 * 生成する画像情報をキューに登録する
	 *
	 * @param data - 登録データ
	 *
	 * @returns 登録されたデータ数
	 */
	async insert(data: Readonly<Insertable<Omit<DQueue, 'registered_at'>>>): Promise<number> {
		let query = this.db.insertInto('d_queue');
		query = query.values({
			file_path: jsToSQLiteAssignment(data.file_path),
			file_type: jsToSQLiteAssignment(data.file_type),
			width: jsToSQLiteAssignment(data.width),
			height: jsToSQLiteAssignment(data.height),
			quality: jsToSQLiteAssignment(data.quality),
			registered_at: jsToSQLiteAssignment(new Date()),
		});

		const result = await query.execute();

		return result.length;
	}
}
