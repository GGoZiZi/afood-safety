import { getDb, getSetting } from './db';

export const ITEMS_PER_DAY = 4;
export const ATTEND_STATUS = ['참석', '연차', '반차', '교육', '공가', '출장', '기타'];
export const DEFAULT_RULES = [
  '설비 유지·보수 시 설비를 정지하고 작업한다',
  '관리감독자의 지시에 따라 안전작업절차를 준수한다.',
  '보호구를 반드시 착용하고 작업한다',
  '정리정돈을 수시로 실시하여 쾌적한 작업환경을 만든다',
  '가동 중인 칼날,스크류,체인 등에 접근하지 않으며, 방호조치를 임의 해제하지 않는다.',
];

export function safetyRules() {
  const v = getSetting('tbm_rules', '');
  return v ? JSON.parse(v) : DEFAULT_RULES;
}

export function tbmTime() {
  return getSetting('tbm_time', '07:45 ~ 08:00');
}

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 월=1 … 일=7
export function weekday(date) {
  const w = new Date(`${date}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}
export const WEEKDAY_LABEL = ['', '월', '화', '수', '목', '금', '토', '일'];

export function listTbmDepts() {
  return getDb().prepare('SELECT * FROM tbm_depts WHERE active = 1 ORDER BY sort, code').all();
}

export function getDept(code) {
  return getDb().prepare('SELECT * FROM tbm_depts WHERE code = ?').get(code);
}

export function isTbmDay(dept, date) {
  return dept.weekdays.split(',').map(Number).includes(weekday(date));
}

export function deptMembers(code) {
  return getDb().prepare('SELECT * FROM tbm_members WHERE dept = ? AND active = 1 ORDER BY sort, id').all(code);
}

// 부서 공정들의 위험요인을 공정별로 한 건씩 번갈아 뽑은 순환 목록 (기존 엑셀 스크립트와 같은 방식)
export function buildCycle(year, dept) {
  const rows = getDb()
    .prepare(`SELECT r.id, r.process_code, r.hazard, r.current_measure FROM risk_items r
      JOIN processes p ON p.year = r.year AND p.code = r.process_code
      WHERE r.year = ? AND p.tbm_dept = ? AND r.deleted = 0 AND r.visibility = '공개' AND r.hazard IS NOT NULL
      ORDER BY p.seq, CAST(SUBSTR(r.item_code, INSTR(r.item_code, '-') + 1) AS INTEGER)`)
    .all(year, dept);
  const queues = new Map();
  for (const r of rows) {
    if (!queues.has(r.process_code)) queues.set(r.process_code, []);
    queues.get(r.process_code).push(r);
  }
  const lists = [...queues.values()];
  const cycle = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) cycle.push(l[i]);
  }
  return cycle;
}

// 그 날짜에 해당 부서 TBM에 들어갈 재해사례
export function casesFor(dept, date) {
  return getDb()
    .prepare(`SELECT * FROM accident_cases
      WHERE status = '채택' AND share_from IS NOT NULL
        AND ? BETWEEN share_from AND date(share_from, '+' || (share_days - 1) || ' days')
        AND (depts = '전체' OR (',' || depts || ',') LIKE ?)
      ORDER BY share_from DESC, id DESC`)
    .all(date, `%,${dept},%`);
}

export function autoCaseText(dept, date) {
  return casesFor(dept, date).map((c) => `[${c.category ?? '사례'}] ${c.title}`).join('\n');
}

export function findMeeting(dept, date) {
  return getDb().prepare('SELECT * FROM tbm_meetings WHERE dept = ? AND date = ?').get(dept, date);
}

// 그날 TBM이 없으면 만든다: 위험요인 4건(순환), 참석자(부서 팀원), 부서 기본값
export function getOrCreateMeeting(dept, date) {
  const existing = findMeeting(dept, date);
  if (existing) return existing;
  const db = getDb();
  const d = getDept(dept);
  if (!d) throw new Error(`TBM 부서가 없습니다: ${dept}`);
  const year = Number(date.slice(0, 4));
  return db.transaction(() => {
    const seq = db.prepare('SELECT COUNT(*) AS n FROM tbm_meetings WHERE year = ? AND dept = ?').get(year, dept).n + 1;
    const info = db
      .prepare(`INSERT INTO tbm_meetings (year, dept, date, seq, time_text, work_name, work_content, place)
        VALUES (?, ?, ?, ?, ?, ?, 'TBM 일일 위험요인 공유 및 안전작업 확인', ?)`)
      .run(year, dept, date, seq, tbmTime(), d.work_name, d.place ?? dept);
    const id = info.lastInsertRowid;
    const cycle = buildCycle(year, dept);
    const ins = db.prepare('INSERT INTO tbm_items (meeting_id, slot, risk_item_id, hazard, measure) VALUES (?, ?, ?, ?, ?)');
    for (let k = 0; k < ITEMS_PER_DAY && cycle.length; k++) {
      const r = cycle[((seq - 1) * ITEMS_PER_DAY + k) % cycle.length];
      ins.run(id, k + 1, r.id, r.hazard, r.current_measure);
    }
    const att = db.prepare('INSERT INTO tbm_attendance (meeting_id, name, status, sort) VALUES (?, ?, ?, ?)');
    deptMembers(dept).forEach((m, i) => att.run(id, m.name, '참석', i));
    db.prepare("INSERT INTO tbm_history (meeting_id, action) VALUES (?, '생성')").run(id);
    return db.prepare('SELECT * FROM tbm_meetings WHERE id = ?').get(id);
  })();
}

export function meetingFull(meeting) {
  const db = getDb();
  const items = db.prepare('SELECT * FROM tbm_items WHERE meeting_id = ? ORDER BY slot').all(meeting.id);
  const attendance = db
    .prepare(`SELECT a.*, m.lang FROM tbm_attendance a
      LEFT JOIN tbm_members m ON m.dept = ? AND m.name = a.name
      WHERE a.meeting_id = ? ORDER BY a.sort, a.name`)
    .all(meeting.dept, meeting.id);
  const dept = getDept(meeting.dept);
  const cases = casesFor(meeting.dept, meeting.date);
  const caseText = meeting.case_text ?? cases.map((c) => `[${c.category ?? '사례'}] ${c.title}`).join('\n');
  return { meeting, items, attendance, dept, cases, caseText };
}

export function meetingHistory(id) {
  return getDb().prepare('SELECT * FROM tbm_history WHERE meeting_id = ? ORDER BY id DESC').all(id);
}

// 부서 위험요인 중 교체 후보 (TBM 항목 바꾸기용)
export function deptRiskOptions(year, dept) {
  return getDb()
    .prepare(`SELECT r.id, r.item_code, r.hazard, r.risk FROM risk_items r
      JOIN processes p ON p.year = r.year AND p.code = r.process_code
      WHERE r.year = ? AND p.tbm_dept = ? AND r.deleted = 0 AND r.visibility = '공개'
      ORDER BY p.seq, CAST(SUBSTR(r.item_code, INSTR(r.item_code, '-') + 1) AS INTEGER)`)
    .all(year, dept);
}

// 기간 안의 TBM 실시일 목록
export function tbmDays(dept, from, to) {
  const days = [];
  for (let d = from; d <= to && days.length < 400; d = addDays(d, 1)) if (isTbmDay(dept, d)) days.push(d);
  return days;
}
