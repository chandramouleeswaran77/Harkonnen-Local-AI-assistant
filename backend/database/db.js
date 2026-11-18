import fs from 'fs';
import Database from 'better-sqlite3';
import { CONFIG, DEFAULT_SETTINGS } from '../config.js';
import { runMigrations } from './migrations.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('db');

let dbInstance = null;

export function initDatabase() {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });

  dbInstance = new Database(CONFIG.DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  runMigrations(dbInstance);
  log.info('SQLite database initialized', { path: CONFIG.DB_PATH });
  return dbInstance;
}

export function getDb() {
  if (!dbInstance) return initDatabase();
  return dbInstance;
}

export function getSetting(key, fallback = undefined) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback !== undefined ? fallback : DEFAULT_SETTINGS[key];
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return result;
}

export function setSetting(key, value) {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, JSON.stringify(value));
}

export function setSettingsBulk(updates) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      stmt.run(k, JSON.stringify(v));
    }
  });
  tx(Object.entries(updates));
}
