import * as XLSX from 'xlsx';
import { getDb, getSetting } from './db';

// 기존 "위험성평가 예산편성 및 집행" 시트의 구분
export const DEFAULT_CATEGORIES = [
  '공장안전시설 검사비용',
  '현장안전시설 개선비용 (위험성 유발 개선 설비수리, 수선 비용)',
  '개인보호구 및 안전장구 구입비용',
  '안전보건교육 실시비용 (내/외부)',
  '작업환경측정 및 근로자 건강검진 실시 비용',
  '안전관련 행사비용',
  '안전보건표지 및 캠페인 진행',
  '관련회의 및 토론회 개최 비용',
  '안전보건전산화 시스템 이용료',
];
const [INSPECT, REPAIR, PPE, EDU, HEALTH, EVENT, SIGN, MEET, IT] = DEFAULT_CATEGORIES;

// 처음 쓸 때 넣는 분류 낱말. 화면에서 고치고 더할 수 있다. 앞에 있는 것이 먼저 적용된다
export const DEFAULT_RULES = [
  ['스마플', IT], ['안전보건 전자시스템', IT],
  ['작업환경측정', HEALTH], ['건강검진', HEALTH], ['특수검진', HEALTH], ['일반검진', HEALTH], ['검진비', HEALTH], ['산업보건', HEALTH],
  ['승강기 유지보수', REPAIR],
  ['안전검사', INSPECT], ['가스안전', INSPECT], ['승강기', INSPECT], ['전기안전관리', INSPECT], ['소방시설', INSPECT], ['소방안전', INSPECT],
  ['타당성검토', INSPECT], ['정밀점검', INSPECT], ['압력용기', INSPECT], ['검사수수료', INSPECT], ['원자력안전', INSPECT],
  ['안전화', PPE], ['귀덮개', PPE], ['귀마개', PPE], ['방진마스크', PPE], ['방독마스크', PPE], ['보안경', PPE], ['안전모', PPE],
  ['절단방지', PPE], ['논슬립', PPE], ['보호구', PPE], ['안전장갑', PPE], ['구급', PPE], ['응급', PPE], ['AED', PPE], ['자동심장충격기', PPE],
  ['안전교육', EDU], ['안전보건교육', EDU], ['위험성평가 교육', EDU], ['위평교육', EDU], ['관리감독자', EDU], ['심폐소생', EDU], ['직무교육', EDU], ['조종사', EDU],
  ['ISO45001', EVENT], ['iso45001', EVENT], ['무재해', EVENT], ['안전보건의 날', EVENT],
  ['안전보건 캠페인', SIGN], ['안전보건캠페인', SIGN], ['안전표지', SIGN], ['안전포스터', SIGN], ['표지판', SIGN],
  ['산업안전보건위원회', MEET], ['산안위', MEET], ['안전보건협의체', MEET], ['위험성평가 사전미팅', MEET], ['위험성평가 회의', MEET],
];

// 수선비 계정은 낱말이 없어도 "현장안전시설 개선비용" 후보로 올리고 검토를 받는다
const REVIEW_ACCOUNT = /수선비/;
export const REVIEW_CATEGORY = REPAIR;

export function ensureBudgetDefaults(year) {
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM budget_plans WHERE year = ? LIMIT 1').get(year)) {
    const prev = db.prepare('SELECT * FROM budget_plans WHERE year = (SELECT MAX(year) FROM budget_plans WHERE year < ?) ORDER BY sort').all(year);
    const ins = db.prepare('INSERT INTO budget_plans (year, category, sort, planned, detail) VALUES (?, ?, ?, ?, ?)');
    const src = prev.length ? prev.map((p) => [p.category, p.sort, null, p.detail]) : DEFAULT_CATEGORIES.map((c, i) => [c, i, null, null]);
    db.transaction(() => src.forEach(([c, s, pl, d]) => ins.run(year, c, s, pl, d)))();
  }
  if (!db.prepare('SELECT 1 FROM budget_rules LIMIT 1').get()) {
    const ins = db.prepare('INSERT OR IGNORE INTO budget_rules (keyword, category, priority) VALUES (?, ?, ?)');
    db.transaction(() => DEFAULT_RULES.forEach(([k, c], i) => ins.run(k, c, i * 10)))();
  }
}

export function includeVat() {
  return getSetting('budget_include_vat', '1') === '1';
}

export function listRules() {
  return getDb().prepare('SELECT * FROM budget_rules ORDER BY priority, id').all();
}

export function classify(memo, rules) {
  const m = memo.toLowerCase();
  return rules.find((r) => m.includes(r.keyword.toLowerCase())) ?? null;
}

const S = (v) => (v == null ? '' : String(v).trim());
const N = (v) => {
  if (typeof v === 'number') return v;
  const s = S(v).replace(/[^0-9.-]/g, '');
  return s ? Number(s) : 0;
};
const ymd = (v) => {
  if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const s = S(v).replace(/[./]/g, '-');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

// ERP "계정내역" 엑셀 → (전표번호, 비고)별 비용 합계. 비용 계정(4로 시작, 제)·판)), 선급금만 세고
// 미지급금·예금 같은 결제 줄은 빼서 같은 돈을 두 번 세지 않는다. 부가세대급금은 따로 모은다.
export function parseErp(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, raw: true });
    const h = rows.findIndex((r) => r.some((c) => S(c) === '비고') && r.some((c) => S(c).startsWith('차변')));
    if (h < 0) continue;
    const head = rows[h].map(S);
    const col = (re) => head.findIndex((c) => re.test(c));
    const C = { date: col(/회계일/), acc: col(/^계정$/), accName: col(/계정명/), voucher: col(/전표번호/), memo: col(/^비고$/),
      debit: col(/^차변/), credit: col(/^대변/), vendor: col(/거래처명/), dept: col(/부서명/) };
    const map = new Map();
    for (const r of rows.slice(h + 1)) {
      const memo = S(r[C.memo]);
      const date = ymd(r[C.date]);
      if (!memo || !date) continue;
      const voucher = S(r[C.voucher]) || null;
      const key = `${voucher}\u0000${memo}`;
      let e = map.get(key);
      if (!e) map.set(key, (e = { date, voucher, memo, vendor: null, dept: null, accounts: new Set(), amount: 0, vat: 0 }));
      const accName = S(r[C.accName]);
      const acc = S(r[C.acc]);
      const net = N(r[C.debit]) - N(r[C.credit]);
      if (acc.startsWith('4') || /^(제|판)\)/.test(accName) || accName.startsWith('선급금')) { e.amount += net; e.accounts.add(accName); }
      else if (accName.startsWith('부가세대급금')) e.vat += net;
      if (!e.vendor && S(r[C.vendor])) e.vendor = S(r[C.vendor]);
      if (!e.dept && S(r[C.dept])) e.dept = S(r[C.dept]);
    }
    const entries = [...map.values()].filter((e) => e.amount > 0).map((e) => ({ ...e, accounts: [...e.accounts].join(', ') }));
    return { sheet: sn, lines: rows.length - h - 1, entries };
  }
  throw new Error('"비고"와 "차변" 머리글이 있는 ERP 계정내역 시트를 찾지 못했습니다.');
}

// 기존 예산 엑셀의 "예산편성 및 집행" 시트에서 구분·편성액·편성내역을 읽는다 (없으면 빈 배열)
export function parsePlanSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sn = wb.SheetNames.find((n) => n.includes('예산편성'));
  if (!sn) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, raw: true });
  const h = rows.findIndex((r) => S(r[0]) === '구분');
  if (h < 0) return [];
  return rows.slice(h + 1)
    .filter((r) => S(r[0]) && S(r[0]) !== '합계')
    .map((r) => ({ category: S(r[0]).replace(/\s*\n\s*/g, ' ').replace(/\(\s*/g, '(').replace(/^(.+?)\s*\((.+)\)$/, '$1 ($2)'), planned: N(r[1]) || null, detail: S(r[2]) || null }));
}

export function budgetSummary(year) {
  const db = getDb();
  const vat = includeVat();
  const plans = db.prepare('SELECT * FROM budget_plans WHERE year = ? ORDER BY sort, category').all(year);
  const spent = new Map(
    db.prepare(`SELECT category, SUM(amount + ${vat ? 'vat' : '0'}) AS s, COUNT(*) AS n FROM budget_entries
      WHERE year = ? AND status IN ('자동', '확인') GROUP BY category`).all(year).map((r) => [r.category, r]),
  );
  const rows = plans.map((p) => ({ ...p, spent: spent.get(p.category)?.s ?? 0, count: spent.get(p.category)?.n ?? 0 }));
  const review = db.prepare("SELECT COUNT(*) AS n, SUM(amount) AS s FROM budget_entries WHERE year = ? AND status = '검토'").get(year);
  const heads = db.prepare('SELECT COUNT(*) AS n FROM employees WHERE active = 1').get().n;
  return {
    rows,
    total: { planned: rows.reduce((a, r) => a + (r.planned ?? 0), 0), spent: rows.reduce((a, r) => a + r.spent, 0) },
    review, heads, vat,
  };
}

export const won = (n) => (n == null ? '' : `${Math.round(n).toLocaleString('ko-KR')}`);
