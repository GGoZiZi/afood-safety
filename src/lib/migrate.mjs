// 이미 만들어진 DB에 새 열을 덧붙인다 (CREATE TABLE IF NOT EXISTS는 열을 추가하지 않으므로).
// 앱(db.js)과 가져오기 스크립트가 같이 쓴다.
const COLUMNS = [
  ['processes', 'tbm_dept', 'TEXT'],
  ['history', 'user_name', 'TEXT'],
];

export function migrate(db) {
  for (const [table, col, type] of COLUMNS) {
    const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
    if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  }
}
