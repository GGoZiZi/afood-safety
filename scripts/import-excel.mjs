// 기존 정기위험성평가 엑셀을 앱 DB로 가져온다.
//
// 사용법:
//   npm run import -- "D:\AFOOD\위험성평가\2026\26년 위험성평가 실시\에이푸드(주) 정기위험성평가_2026.08.10.xlsx" 2026
//   (이미 데이터가 있는 연도를 다시 가져오려면 끝에 --replace)
//
// 가져오는 시트: 직원명부, 공정목록_수정추가, 위험성평가_수정추가, 사진목록, 코드표

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import XLSX from 'xlsx';

const args = process.argv.slice(2);
const replace = args.includes('--replace');
const [file, yearArg] = args.filter((a) => a !== '--replace');
if (!file || !yearArg) {
  console.error('사용법: npm run import -- "<엑셀 파일 경로>" <평가연도> [--replace]');
  process.exit(1);
}
const year = Number(yearArg);
if (!fs.existsSync(file)) {
  console.error(`파일을 찾을 수 없습니다: ${file}`);
  process.exit(1);
}

const dataDir = process.env.AFOOD_DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'afood.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf8'));

const wb = XLSX.readFile(file, { cellDates: true });

// 시트를 머리글 기준 객체 배열로 읽는다
function rows(sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`  (시트 없음: ${sheetName})`);
    return [];
  }
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

// 엑셀 수식이 빈칸을 0으로 남긴 경우가 많아 0/'0'/공백은 빈값으로 본다
function text(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null;
  const s = String(v).trim();
  return s === '' || s === '0' ? null : s;
}
function score(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
function date(v) {
  if (v instanceof Date) {
    if (v.getFullYear() < 1900) return null; // 00:00:00 같은 시간값
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  const s = text(v);
  if (!s) return null;
  const m = s.match(/(\d{4})[-.년\s]+(\d{1,2})[-.월\s]+(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
}
function deptOf(space) {
  return space ? String(space).split('>')[0].trim() : null;
}

const existing = db.prepare('SELECT COUNT(*) AS n FROM risk_items WHERE year = ?').get(year).n;
if (existing && !replace) {
  console.error(`${year}년 데이터가 이미 ${existing}건 있습니다. 덮어쓰려면 --replace 를 붙이세요.`);
  process.exit(1);
}

const run = db.transaction(() => {
  if (replace) {
    db.prepare("DELETE FROM history WHERE table_name = 'risk_items' AND row_id IN (SELECT id FROM risk_items WHERE year = ?)").run(year);
    for (const t of ['risk_items', 'processes', 'photos']) db.prepare(`DELETE FROM ${t} WHERE year = ?`).run(year);
  }
  db.prepare('INSERT OR IGNORE INTO years (year, title) VALUES (?, ?)').run(year, `${year}년 정기위험성평가`);
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('improvement_threshold', '8')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('current_year', ?)").run(String(year));

  // 직원명부
  const empStmt = db.prepare(`INSERT INTO employees (dept1, dept2, name, title, phone) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (dept1, name) DO UPDATE SET dept2 = excluded.dept2, title = excluded.title, phone = excluded.phone`);
  let nEmp = 0;
  for (const r of rows('직원명부')) {
    if (!text(r['이름'])) continue;
    empStmt.run(text(r['부서1']) || '', text(r['부서2']), text(r['이름']), text(r['직급']), text(r['연락처']));
    nEmp++;
  }

  // 공정목록
  const baseCols = new Set(['작업구분', '공정순서', '공정ID', '공간명', '공정명', '세부작업명', '설비', '물질', '실행책임자', '추진자', '비고', '매칭용순번(자동계산)']);
  const procStmt = db.prepare(`INSERT INTO processes (year, code, seq, space, dept, name, sub_task, equipment, material, owner, promoter, note, work_status, extra)
    VALUES (@year, @code, @seq, @space, @dept, @name, @sub_task, @equipment, @material, @owner, @promoter, @note, @work_status, @extra)`);
  let nProc = 0;
  for (const r of rows('공정목록_수정추가')) {
    const code = text(r['공정ID']);
    if (!code || !text(r['공정명'])) continue;
    const extra = {};
    for (const [k, v] of Object.entries(r)) if (!baseCols.has(k) && text(v)) extra[k] = text(v);
    procStmt.run({
      year, code, seq: Number(r['공정순서']) || nProc + 1,
      space: text(r['공간명']), dept: deptOf(r['공간명']), name: text(r['공정명']),
      sub_task: text(r['세부작업명']), equipment: text(r['설비']), material: text(r['물질']),
      owner: text(r['실행책임자']), promoter: text(r['추진자']), note: text(r['비고']),
      work_status: text(r['작업구분']) || '기존', extra: JSON.stringify(extra),
    });
    nProc++;
  }

  // 위험성평가
  const riskStmt = db.prepare(`INSERT INTO risk_items (year, item_code, process_code, space, dept, process_name, sub_task, category, cause, hazard,
      legal_basis, pre_owner, current_measure, likelihood, severity, risk, reduction, post_likelihood, post_severity, post_risk,
      action_owner, due_date, prev_action_no, note, note2, photo_link_id, work_status, deleted)
    VALUES (@year, @item_code, @process_code, @space, @dept, @process_name, @sub_task, @category, @cause, @hazard,
      @legal_basis, @pre_owner, @current_measure, @likelihood, @severity, @risk, @reduction, @post_likelihood, @post_severity, @post_risk,
      @action_owner, @due_date, @prev_action_no, @note, @note2, @photo_link_id, @work_status, @deleted)`);
  let nRisk = 0;
  let nSkip = 0;
  for (const r of rows('위험성평가_수정추가')) {
    const itemCode = text(r['항목ID']);
    const hazard = text(r['유해위험요인']);
    if (!itemCode || !hazard) { if (itemCode || hazard) nSkip++; continue; }
    const status = text(r['작업구분']) || '기존';
    const L = score(r['가능성']);
    const S = score(r['중대성']);
    const pL = score(r['개선 후 가능성']);
    const pS = score(r['개선 후 중대성']);
    riskStmt.run({
      year, item_code: itemCode, process_code: itemCode.split('-')[0],
      space: text(r['공간명']), dept: deptOf(r['공간명']), process_name: text(r['공정명']), sub_task: text(r['세부작업명']),
      category: text(r['분류']), cause: text(r['원인']), hazard,
      legal_basis: text(r['관련근거']), pre_owner: text(r['위평전 사전조치담당']), current_measure: text(r['현재 안전보건조치']),
      likelihood: L, severity: S, risk: L && S ? L * S : score(r['위험성']),
      reduction: text(r['감소대책']), post_likelihood: pL, post_severity: pS, post_risk: pL && pS ? pL * pS : score(r['개선 후 위험성']),
      action_owner: text(r['조치담당자']), due_date: date(r['조치예정일']), prev_action_no: text(r['기존 조치번호']),
      note: text(r['비고']), note2: text(r['비고1']), photo_link_id: text(r['사진연결ID']),
      work_status: status === '삭제' ? '기존' : status, deleted: status === '삭제' ? 1 : 0,
    });
    nRisk++;
  }

  // 사진목록
  const photoStmt = db.prepare('INSERT INTO photos (year, link_id, kind, filename, description, taken_at, note) VALUES (?, ?, ?, ?, ?, ?, ?)');
  let nPhoto = 0;
  for (const r of rows('사진목록')) {
    const link = text(r['사진연결ID']);
    const fn = text(r['사진파일명']);
    if (!link || !fn) continue;
    photoStmt.run(year, link, text(r['사진구분']), fn, text(r['사진설명']), date(r['촬영일']), text(r['비고']));
    nPhoto++;
  }

  // 코드표 (가능성, 중대성, 분류/원인)
  const codeStmt = db.prepare(`INSERT INTO codes (kind, code, label, description, sort) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (kind, code) DO UPDATE SET label = excluded.label, description = excluded.description, sort = excluded.sort`);
  const ws = wb.Sheets['코드표'];
  let nCode = 0;
  if (ws) {
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    let mode = null;
    grid.forEach((row, i) => {
      const a = text(row[0]);
      if (!a) return;
      if (a.startsWith('가능성')) { mode = 'likelihood'; return; }
      if (a.startsWith('중대성')) { mode = 'severity'; return; }
      if (a === '분류') { mode = 'cause'; return; }
      if (mode === 'cause') {
        const cause = text(row[1]);
        if (cause) { codeStmt.run('cause', cause, a, null, i); nCode++; }
      } else if (mode) {
        codeStmt.run(mode, a, text(row[1]) || a, text(row[2]), i); nCode++;
      }
    });
  }

  return { nEmp, nProc, nRisk, nSkip, nPhoto, nCode };
});

const r = run();
console.log(`${year}년 가져오기 완료`);
console.log(`  직원 ${r.nEmp}명, 공정 ${r.nProc}개, 위험요인 ${r.nRisk}건, 사진 ${r.nPhoto}장, 코드 ${r.nCode}개`);
if (r.nSkip) console.log(`  항목ID나 유해위험요인이 비어 건너뛴 행: ${r.nSkip}행`);
