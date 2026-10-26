import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { migrate } from './migrate.mjs';

// 데이터 파일 위치. 기본값은 프로젝트의 data/afood.db (백업은 이 파일만 복사하면 된다)
export const DATA_DIR = process.env.AFOOD_DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'afood.db');
const SCHEMA_PATH = path.join(process.cwd(), 'src', 'lib', 'schema.sql');

export function openDb(file = DB_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  migrate(db);
  return db;
}

// Next.js 개발 서버가 모듈을 다시 불러와도 연결은 하나만 유지
const g = globalThis;
export function getDb() {
  if (!g.__afoodDb) g.__afoodDb = openDb();
  return g.__afoodDb;
}

export function getSetting(key, fallback) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

// 개선대상 기준 점수 (위험성이 이 점수 이상이면 개선조치 대상)
export function improvementThreshold() {
  return Number(getSetting('improvement_threshold', '8'));
}
