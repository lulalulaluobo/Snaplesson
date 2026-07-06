import { DatabaseSync } from 'node:sqlite'

/**
 * 创建并初始化数据库实例（含 schema 和迁移）。
 * @param {string} dbPath - SQLite 数据库文件的绝对路径
 * @returns {DatabaseSync}
 */
export function createDb(dbPath) {
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA foreign_keys = ON')

  // 初始化数据库 Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      salt TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      username TEXT PRIMARY KEY,
      openai_base_url TEXT,
      openai_model TEXT,
      openai_api_key TEXT,
      tts_provider TEXT DEFAULT 'edge',
      tts_voice TEXT DEFAULT 'en-US-EmmaNeural',
      tts_base_url TEXT,
      tts_api_key TEXT,
      tts_model TEXT,
      ocr_provider TEXT DEFAULT 'mimo',
      ocr_base_url TEXT,
      ocr_api_key TEXT,
      ocr_model TEXT,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      courseId TEXT NOT NULL,
      title TEXT NOT NULL,
      level TEXT NOT NULL,
      audioFile TEXT NOT NULL,
      subtitlesJson TEXT, -- JSON mapping language keys to file names
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vocab (
      username TEXT NOT NULL,
      id TEXT NOT NULL,
      word TEXT NOT NULL,
      phonetic TEXT,
      translation TEXT,
      createdAt INTEGER,
      PRIMARY KEY (username, id),
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      username TEXT NOT NULL,
      id TEXT NOT NULL,
      text TEXT NOT NULL,
      translation TEXT,
      lessonId TEXT,
      audioStart REAL,
      audioEnd REAL,
      createdAt INTEGER,
      PRIMARY KEY (username, id),
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );
  `)

  // Pre-seed a preset course for custom lessons
  try {
    const customCourseExists = db.prepare("SELECT 1 FROM courses WHERE id = 'custom'").get()
    if (!customCourseExists) {
      db.prepare(`
        INSERT INTO courses (id, name, type, createdAt)
        VALUES (?, ?, ?, ?)
      `).run('custom', '我的拍照课程', 'custom', Date.now())
    }
  } catch (err) {
    console.error('Failed to seed custom course:', err)
  }

  return db
}
