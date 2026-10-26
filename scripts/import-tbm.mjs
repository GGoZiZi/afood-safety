// 기존 TBM 회의록 엑셀에서 TBM 설정을 가져온다.
//
// 사용법:
//   npm run import-tbm -- "<TBM 회의록_부서별_2026.01-12.xlsx 경로>" 2026 ["<근로자 위험성평가 참여v1.xlsx 경로>"]
//
// 가져오는 것:
//   - 공정목록의 TBM부서  → 공정별 TBM 부서 연결
//   - 부서별 TBM 시트의 작업명·장소, 연차 시트의 TBM 리더(소속·직책·성명)
//   - 근무표의 마지막 날짜 기준 부서별 팀원 (참석자 명단)
//   - 재해사례 시트 → 재해사례 (공유예정일부터 7일간 TBM에 표시)
//   - TBM 리더를 관리감독자 계정으로 만든다 (처음 PIN 0000, 로그인 후 바꾸기)
//   - 세 번째 파일(근로자 참여)을 주면 시트 이름의 (중국)/(베트남) 표시로 팀원 언어를 정한다

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import XLSX from 'xlsx';
import { migrate } from '../src/lib/migrate.mjs';

const [file, yearArg, participationFile] = process.argv.slice(2);
if (!file || !yearArg) {
  console.error('사용법: npm run import-tbm -- "<TBM 회의록 엑셀 경로>" <평가연도> ["<근로자 참여 엑셀 경로>"]');
  process.exit(1);
}
const year = Number(yearArg);
for (const f of [file, participationFile].filter(Boolean)) {
  if (!fs.existsSync(f)) {
    console.error(`파일을 찾을 수 없습니다: ${f}`);
    process.exit(1);
  }
}

const dataDir = process.env.AFOOD_DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'afood.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf8'));
migrate(db);

console.log('엑셀을 읽는 중입니다 (큰 파일이라 1~2분 걸릴 수 있습니다)...');
const wb = XLSX.readFile(file, { cellDates: true });

const text = (v) => {
  if (v === null || v === undefined || v instanceof Date) return null;
  const s = String(v).trim();
  return s === '' || s === '0' ? null : s;
};
const date = (v) => {
  if (!(v instanceof Date) || v.getFullYear() < 1900) return null;
  return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const rows = (name) => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, raw: true }) : []);
const grid = (name) => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true }) : []);
const hashPin = (pin) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pin, salt, 32).toString('hex')}`;
};

// 부서 목록: "<부서>(TBM)" 시트 이름 순서대로
const deptCodes = wb.SheetNames.filter((n) => n.endsWith('(TBM)')).map((n) => n.replace('(TBM)', ''));
if (deptCodes.length === 0) {
  console.error('"부서(TBM)" 이름의 시트를 찾지 못했습니다. TBM 회의록_부서별 파일이 맞는지 확인해 주세요.');
  process.exit(1);
}

// 연차 시트 오른쪽 표: TBM시트 | 소속 | 직책 | 성명 (열 위치는 "(TBM)"이 들어 있는 칸으로 찾는다)
const leaders = {};
for (const r of grid('연차').slice(1)) {
  const at = r.findIndex((v) => typeof v === 'string' && v.trim().endsWith('(TBM)'));
  if (at >= 0) leaders[r[at].trim().replace('(TBM)', '')] = { affil: text(r[at + 1]), title: text(r[at + 2]), name: text(r[at + 3]) };
}

// 근로자 참여 파일 시트 이름에서 언어 추정
const langOf = {};
if (participationFile) {
  const pw = XLSX.readFile(participationFile, { bookSheets: true });
  for (const n of pw.SheetNames) {
    const m = n.match(/^(.+?)\((중국|베트남|러시아|영어)\)$/);
    if (m) langOf[m[1]] = { 중국: 'zh', 베트남: 'vi', 러시아: 'ru', 영어: 'en' }[m[2]];
  }
}

// 근무표 이름이 줄임말인 경우(수완 ↔ 주티수완)도 맞춘다
const guessLang = (name) => langOf[name] ?? Object.entries(langOf).find(([k]) => k.endsWith(name) || name.endsWith(k))?.[1] ?? 'ko';

const result = db.transaction(() => {
  const out = { depts: 0, procs: 0, members: 0, cases: 0, users: 0 };

  deptCodes.forEach((code, i) => {
    const g = grid(`${code}(TBM)`);
    const find = (label) => {
      const row = g.slice(0, 28).find((r) => text(r[1]) === label);
      return row ? text(row[3]) : null;
    };
    const workName = find('작 업 명');
    const place = find('TBM 장소') ?? code;
    const l = leaders[code] ?? {};
    db.prepare(`INSERT INTO tbm_depts (code, sort, place, work_name, leader_affil, leader_title, leader_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (code) DO UPDATE SET sort = excluded.sort, place = excluded.place, work_name = COALESCE(excluded.work_name, work_name),
        leader_affil = excluded.leader_affil, leader_title = excluded.leader_title, leader_name = excluded.leader_name`)
      .run(code, i + 1, place, workName, l.affil, l.title, l.name);
    out.depts++;
  });

  // 공정 → TBM 부서
  const setDept = db.prepare('UPDATE processes SET tbm_dept = ? WHERE year = ? AND code = ?');
  for (const r of rows('공정목록_수정추가')) {
    const code = text(r['공정ID']);
    const dept = text(r['TBM부서']);
    if (code && dept && deptCodes.includes(dept)) out.procs += setDept.run(dept, year, code).changes;
  }

  // 근무표: 부서별 마지막 날짜의 정규직 명단
  const roster = {};
  for (const r of grid('근무표').slice(1)) {
    const d = date(r[0]);
    const dept = text(r[1]);
    if (!d || !dept || !deptCodes.includes(dept)) continue;
    const names = r.slice(3).map(text).filter(Boolean);
    if (names.length && (!roster[dept] || d >= roster[dept].date)) roster[dept] = { date: d, names };
  }
  const addMember = db.prepare(`INSERT INTO tbm_members (dept, name, lang, sort) VALUES (?, ?, ?, ?)
    ON CONFLICT (dept, name) DO UPDATE SET lang = CASE WHEN excluded.lang != 'ko' THEN excluded.lang ELSE lang END, sort = excluded.sort, active = 1`);
  for (const [dept, { names }] of Object.entries(roster)) {
    const leader = leaders[dept]?.name?.replace(/\(.*\)$/, '');
    names.filter((n) => n !== leader).forEach((n, i) => {
      addMember.run(dept, n, guessLang(n), i);
      out.members++;
    });
  }

  // 재해사례: 분류가 TBM 부서 이름이면 그 부서, "식품업계"는 생산1·2팀, 그 외는 전체
  const existingCase = db.prepare('SELECT 1 FROM accident_cases WHERE title = ? AND share_from IS ?');
  const addCase = db.prepare(`INSERT INTO accident_cases (category, title, occurred_on, share_from, depts, source, url)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const r of rows('재해사례')) {
    const title = text(r['사고내용 및 원인']);
    if (!title) continue;
    const cat = text(r['분류']);
    const shareFrom = date(r['TBM공유예정일']);
    if (existingCase.get(title, shareFrom)) continue;
    const depts = deptCodes.includes(cat) ? cat : cat === '식품업계' ? deptCodes.filter((d) => d.startsWith('생산')).join(',') || '전체' : '전체';
    addCase.run(cat, title, date(r['발생일']), shareFrom, depts, text(r['출처']), text(r['참고링크']));
    out.cases++;
  }

  // TBM 리더 → 관리감독자 계정 (이미 있으면 그대로)
  const addUser = db.prepare("INSERT OR IGNORE INTO users (name, role, dept, pin_hash) VALUES (?, 'supervisor', ?, ?)");
  for (const [dept, l] of Object.entries(leaders)) {
    const name = l.name?.replace(/\(.*\)$/, '');
    if (name) out.users += addUser.run(name, dept, hashPin('0000')).changes;
  }
  return out;
});

const r = result();
console.log('TBM 설정 가져오기 완료');
console.log(`  TBM 부서 ${r.depts}개, 공정 연결 ${r.procs}개, 참석 대상 ${r.members}명, 재해사례 ${r.cases}건, 관리감독자 계정 ${r.users}개`);
if (r.users) console.log('  새 관리감독자 계정의 처음 PIN은 0000 입니다. 로그인 후 "사용자" 메뉴에서 바꾸세요.');
