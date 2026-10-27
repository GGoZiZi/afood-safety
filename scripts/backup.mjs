// 백업: DB는 SQLite 백업 기능으로 안전하게 복사하고(앱이 켜져 있어도 됨), 사진·첨부 문서는 바뀐 파일만 복사한다.
//   node scripts/backup.mjs [백업 폴더]   (기본: ./backup)
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATA_DIR = process.env.AFOOD_DATA_DIR || path.join(process.cwd(), 'data');
const out = path.resolve(process.argv[2] || 'backup');
const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString();
const stamp = `${d.slice(0, 10).replace(/-/g, '')}-${d.slice(11, 16).replace(':', '')}`;

fs.mkdirSync(out, { recursive: true });
const dbFile = path.join(out, `afood-${stamp}.db`);
const db = new Database(path.join(DATA_DIR, 'afood.db'), { readonly: true });
await db.backup(dbFile);
db.close();
console.log(`DB → ${dbFile}`);

for (const sub of ['photos', 'files']) {
  const src = path.join(DATA_DIR, sub);
  if (!fs.existsSync(src)) continue;
  const dst = path.join(out, sub);
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(src)) {
    const a = path.join(src, f);
    const b = path.join(dst, f);
    const st = fs.statSync(a);
    if (!st.isFile()) continue;
    if (fs.existsSync(b) && fs.statSync(b).size === st.size) continue;
    fs.copyFileSync(a, b);
    n++;
  }
  console.log(`${sub}: 새로 복사 ${n}개 → ${dst}`);
}
