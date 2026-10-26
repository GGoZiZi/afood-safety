import { getDb, improvementThreshold } from './db';
import { today } from './tbm';

// 개선조치 상태: 완료 / 지연(예정일 지남) / 진행중 / 미계획
export function improveStatus(r, now = today()) {
  if (r.done_date) return '완료';
  if (!r.due_date) return '미계획';
  return r.due_date < now ? '지연' : '진행중';
}
export const STATUS_CHIP = { 완료: 'ok', 지연: 'hidden', 진행중: 'edit', 미계획: 'old' };

// 개선 대상: 기준점수 이상 위험요인 + 위험성평가에 등록하지 않은 순회점검 지적사항
export function listImprovements(year, { status, dept, source } = {}) {
  const db = getDb();
  const th = improvementThreshold();
  const now = today();
  const risks = source === 'patrol' ? [] : db
    .prepare(`SELECT r.*, (SELECT COUNT(*) FROM photos ph WHERE ph.year = r.year AND ph.link_id = COALESCE(r.photo_link_id, r.item_code) AND ph.kind = '개선후') AS after_count
      FROM risk_items r WHERE r.year = ? AND r.deleted = 0 AND r.risk >= ?
      ORDER BY r.risk DESC, r.process_code, CAST(SUBSTR(r.item_code, INSTR(r.item_code, '-') + 1) AS INTEGER)`)
    .all(year, th)
    .map((r) => ({ kind: 'risk', id: r.id, code: r.item_code, dept: r.dept, process: r.process_name, hazard: r.hazard, measure: r.reduction,
      risk: r.risk, post_risk: r.post_risk, owner: r.action_owner, due_date: r.due_date, done_date: r.done_date, after: r.after_count, row: r }));
  const finds = source === 'risk' ? [] : db
    .prepare(`SELECT f.*, p.date, p.year, pr.dept, pr.name AS process_name FROM patrol_findings f JOIN patrols p ON p.id = f.patrol_id
      LEFT JOIN processes pr ON pr.year = p.year AND pr.code = f.process_code
      WHERE p.year = ? AND f.decision = '미등록' ORDER BY p.date DESC, f.id`)
    .all(year)
    .map((f) => ({ kind: 'patrol', id: f.id, patrolId: f.patrol_id, code: `점검 ${f.date}`, dept: f.dept, process: f.process_name ?? f.location,
      hazard: f.finding, measure: f.measure, risk: null, post_risk: null, owner: f.owner, due_date: f.due_date, done_date: f.done_date,
      after: f.after_photo ? 1 : 0, row: f }));
  let rows = [...risks, ...finds].map((x) => ({ ...x, status: improveStatus(x, now) }));
  if (dept) rows = rows.filter((x) => x.dept === dept);
  const counts = { 전체: rows.length, 미계획: 0, 진행중: 0, 지연: 0, 완료: 0 };
  for (const x of rows) counts[x.status]++;
  if (status) rows = rows.filter((x) => x.status === status);
  return { rows, counts, threshold: th };
}
