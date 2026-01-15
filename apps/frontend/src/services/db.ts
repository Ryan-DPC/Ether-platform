import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export const initDB = async () => {
  if (db) return db;

  // Connect to sqlite database. It will be created if it doesn't exist.
  db = await Database.load('sqlite:vext.db');

  // Create messages table if it doesn't exist
  await db.execute(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            from_user_id TEXT NOT NULL,
            to_user_id TEXT NOT NULL,
            is_from_me BOOLEAN NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

  return db;
};

export const saveMessage = async (msg: any) => {
  const database = await initDB();
  await database.execute(
    `INSERT OR REPLACE INTO messages (id, content, from_user_id, to_user_id, is_from_me, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
    [msg.id, msg.content, msg.from_user_id, msg.to_user_id, msg.is_from_me ? 1 : 0, msg.created_at]
  );
};

export const getMessagesByFriendId = async (friendId: string, myUserId: string) => {
  const database = await initDB();
  const rows = await database.select<any[]>(
    `SELECT * FROM messages 
         WHERE (from_user_id = $1 AND to_user_id = $2) 
            OR (from_user_id = $2 AND to_user_id = $1)
         ORDER BY created_at ASC`,
    [friendId, myUserId]
  );

  return rows.map((row) => ({
    ...row,
    is_from_me: row.is_from_me === 1 || row.is_from_me === true,
  }));
};
