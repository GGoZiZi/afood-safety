import * as XLSX from 'xlsx';
import { getDb, getSetting } from './db';
import { addMonths } from './equipment';
import { addDays, today } from './tbm';

export const EXAM_KINDS = ['일반', '특수', '배치전', '수시', '보건증'];
// 판정 구분 (산업안전보건법 건강진단 결과 판정)
export const RESULTS = ['A', 'C1', 'C2', 'CN', 'D1', 'D2', 'DN', 'R', 'U', '적합', '부적합'];
export const RESULT_LABEL = {
  A: '정상', C1: '직업병 요관찰', C2: '일반질병 요관찰', CN: '야간작업 요관찰', D1: '직업병 유소견', D2: '일반질병 유소견',
  DN: '야간작업 유소견', R: '2차 검진 필요', U: '판정 불가', 적합: '보건증 적합', 부적합: '보건증 부적합',
};
// 사후관리를 챙겨야 하는 판정
export const NEEDS_FOLLOWUP = ['C1', 'C2', 'CN', 'D1', 'D2', 'DN', 'R', '부적합'];
export const SOON_DAYS = 30;
export const STATUS = ['지연', '예정', '첫 검진 필요', '정상'];
export const STATUS_CHIP = { 지연: 'hidden', 예정: 'edit', '첫 검진 필요': 'edit', 정상: 'ok' };

// 사람마다 챙길 검진: 일반·특수·보건증. 배치전 건강진단은 특수의 시작점으로 센다
export function dueList(p, exams, now = today()) {
  const last = (kinds) => exams.filter((e) => kinds.includes(e.kind)).map((e) => e.date).sort().pop() ?? null;
  const out = [];
  const push = (kind, base, cycle) => {
    const due = base ? addMonths(base, cycle) : null;
    const status = !due ? '첫 검진 필요' : due < now ? '지연' : due <= addDays(now, SOON_DAYS) ? '예정' : '정상';
    out.push({ kind, last: base, due, status, cycle });
  };
  if (p.general) push('일반', last(['일반']), p.general_cycle || 12);
  if (p.agents || p.night_work) push('특수', last(['특수', '배치전']), p.special_cycle || 12);
  if (p.food_cert) push('보건증', last(['보건증']), 12);
  return out;
}

export function worst(dues) {
  return dues.map((d) => d.status).sort((a, b) => STATUS.indexOf(a) - STATUS.indexOf(b))[0] ?? '정상';
}

export function listPeople() {
  const db = getDb();
  const exams = db.prepare('SELECT * FROM health_exams ORDER BY date').all();
  const byPerson = new Map();
  for (const e of exams) (byPerson.get(e.person_id) ?? byPerson.set(e.person_id, []).get(e.person_id)).push(e);
  const now = today();
  return db.prepare('SELECT * FROM health_people WHERE active = 1 ORDER BY dept, name').all().map((p) => {
    const ex = byPerson.get(p.id) ?? [];
    const dues = dueList(p, ex, now);
    // 종류별 가장 최근 판정이 사후관리 대상이고 아직 끝내지 않았으면 표시
    const latest = new Map();
    for (const e of ex) latest.set(e.kind, e);
    const followups = [...latest.values()].filter((e) => NEEDS_FOLLOWUP.includes(e.result) && !e.followup_done);
    return { ...p, exams: ex, dues, status: worst(dues), followups };
  });
}

export function agentList(p) {
  return (p.agents ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
}

// ----- 엑셀 가져오기: "일반/특수/보건증 건강진단 설계" 명단 -----

function excelDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return XLSX.SSF.format('yyyy-mm-dd', v);
  const m = String(v).trim().match(/^(\d{4})[-./ ]+(\d{1,2})[-./ ]+(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
}

// "791117-1" → 1979-11-17 (뒷자리 첫 숫자로 1900/2000년대 구분, 나머지는 버린다)
export function birthFromRrn(v) {
  const m = String(v ?? '').match(/(\d{2})(\d{2})(\d{2})\s*-?\s*(\d)?/);
  if (!m) return null;
  const century = ['3', '4', '7', '8'].includes(m[4]) ? '20' : '19';
  return `${century}${m[1]}-${m[2]}-${m[3]}`;
}

// "1. 용접 흄 2. 망간 및 무기화합물 3. 소음" → 줄마다 하나
export function splitAgents(v) {
  const s = String(v ?? '').trim();
  if (!s || /^x$/i.test(s)) return [];
  return s.split(/\s*\d+\.\s*/).map((a) => a.trim()).filter(Boolean);
}

const yes = (v) => /^(o|○|y|예|대상)$/i.test(String(v ?? '').trim());

export function parseRoster(buffer) {
  const wb = XLSX.read(buffer, { cellDates: false });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const h = rows.findIndex((r) => r.some((c) => String(c).trim() === '성명'));
    if (h < 0) continue;
    const head = rows[h].map((c) => String(c).replace(/\s+/g, ''));
    const col = (label) => head.findIndex((c) => c.includes(label));
    const c = {
      dept: col('부서'), name: col('성명'), rrn: col('생년월일'), sex: col('성별'), night: col('야간'), hire: col('입사'),
      phone: col('핸드폰') >= 0 ? col('핸드폰') : col('연락처'), general: col('일반'), special: col('특수'), food: col('보건증'),
    };
    const at = (r, k) => (c[k] >= 0 ? r[c[k]] : '');
    const people = [];
    for (const r of rows.slice(h + 1)) {
      const nm = String(at(r, 'name')).trim();
      if (!nm) continue;
      const agents = splitAgents(at(r, 'special'));
      people.push({
        dept: String(at(r, 'dept')).trim() || null,
        name: nm,
        birth: birthFromRrn(at(r, 'rrn')),
        sex: String(at(r, 'sex')).trim() || null,
        phone: String(at(r, 'phone')).trim() || null,
        hire_date: excelDate(at(r, 'hire')),
        night_work: yes(at(r, 'night')) ? 1 : 0,
        general: c.general >= 0 ? (yes(at(r, 'general')) ? 1 : 0) : 1,
        agents: agents.join('\n') || null,
        food_cert: c.food >= 0 ? (yes(at(r, 'food')) ? 1 : 0) : 1,
      });
    }
    return people;
  }
  throw new Error('"성명" 칸이 있는 시트를 찾지 못했습니다.');
}

// ----- 작업환경측정 -----

export function measureCycle() {
  return Number(getSetting('measure_cycle_months', '6'));
}

export function listMeasurements() {
  const db = getDb();
  const ms = db.prepare('SELECT * FROM measurements ORDER BY date DESC').all();
  const res = db.prepare('SELECT * FROM measurement_results WHERE measurement_id = ? ORDER BY place, agent');
  return ms.map((m) => {
    const results = res.all(m.id).map((r) => ({ ...r, over: r.value != null && r.limit_value != null && r.value > r.limit_value }));
    return { ...m, results, over: results.filter((r) => r.over).length };
  });
}

export function nextMeasurement(ms) {
  const last = ms[0]?.date;
  const due = last ? addMonths(last, measureCycle()) : null;
  const now = today();
  return { last, due, status: !due ? '첫 측정 필요' : due < now ? '지연' : due <= addDays(now, SOON_DAYS * 2) ? '예정' : '정상' };
}

// ----- 보호구 -----

export const PPE_MOVES = ['입고', '지급', '폐기'];

export function listPpe() {
  return getDb()
    .prepare(`SELECT i.*,
        COALESCE((SELECT SUM(CASE WHEN m.kind = '입고' THEN m.qty ELSE -m.qty END) FROM ppe_moves m WHERE m.item_id = i.id), 0) AS stock,
        COALESCE((SELECT SUM(m.qty) FROM ppe_moves m WHERE m.item_id = i.id AND m.kind = '지급' AND m.date >= date('now','localtime','start of year')), 0) AS issued_year
      FROM ppe_items i WHERE i.active = 1 ORDER BY i.kind, i.name`)
    .all();
}

// 교체주기가 있는 품목: 사람마다 마지막 지급일 + 주기가 지나면 교체 대상
export function ppeReplaceDue(now = today()) {
  return getDb()
    .prepare(`SELECT i.name AS item, i.replace_months, m.person, m.dept, MAX(m.date) AS last
      FROM ppe_moves m JOIN ppe_items i ON i.id = m.item_id
      WHERE m.kind = '지급' AND m.person IS NOT NULL AND i.replace_months > 0 AND i.active = 1
      GROUP BY m.item_id, m.person`)
    .all()
    .map((r) => ({ ...r, due: addMonths(r.last, r.replace_months) }))
    .filter((r) => r.due <= addDays(now, SOON_DAYS))
    .sort((a, b) => a.due.localeCompare(b.due));
}
