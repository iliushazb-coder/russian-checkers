import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Эта функция инициализирует базу данных SQLite
export async function initializeDatabase() {
  const db = await open({
    filename: './database.sqlite', // Файл базы данных создастся автоматически в папке server
    driver: sqlite3.Database
  });

  // Создаем таблицу для хранения истории игр (пока простая, для проверки работы БД)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      winner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ База данных SQLite успешно инициализирована!');
  return db;
}