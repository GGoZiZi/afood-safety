import { getDb, improvementThreshold } from './db';

// 위험성평가 대장에 쓰는 필드 (폼, 이력 비교, 엑셀 내보내기 공통)
export const RISK_FIELDS = [
  ['item_code', '항목ID'],
  ['process_code', '공정ID'],
  ['space', '공간명'],
  ['process_name', '공정명'],
  ['sub_task', '세부작업명'],
  ['category', '분류'],
  ['cause', '원인'],
  ['hazard', '유해위험요인'],
  ['legal_basis', '관련근거'],
  ['pre_owner', '위평전 사전조치담당'],
  ['current_measure', '현재 안전보건조치'],
  ['likelihood', '가능성'],
  ['severity', '중대성'],
  ['risk', '위험성'],
  ['reduction', '감소대책'],
  ['post_likelihood', '개선 후 가능성'],
  ['post_severity', '개선 후 중대성'],
  ['post_risk', '개선 후 위험성'],
  ['action_owner', '조치담당자'],
  ['due_date', '조치예정일'],
  ['done_date', '완료일'],
  ['prev_action_no', '기존 조치번호'],
  ['note', '비고'],
  ['note2', '비고1'],
  ['photo_link_id', '사진연결ID'],
  ['work_status', '작업구분'],
  ['visibility', '공개'],
];
export const FIELD_LABEL = Object.fromEntries(RISK_FIELDS);

export function listYears() {
  return getDb().prepare('SELECT * FROM years ORDER BY year DESC').all();
}

export function listProcesses(year) {
  return getDb().prepare('SELECT * FROM processes WHERE year = ? ORDER BY seq, code').all(year);
}

export function listDepts(year) {
  return getDb()
    .prepare("SELECT DISTINCT dept FROM risk_items WHERE year = ? AND dept IS NOT NULL ORDER BY dept")
    .all(year)
    .map((r) => r.dept);
}

export function listCodes(kind) {
  return getDb().prepare('SELECT * FROM codes WHERE kind = ? ORDER BY sort').all(kind);
}

// 대장 목록 조회. filters: { dept, process, minRisk, vis, status, q, deleted }
export function searchRisks(year, filters = {}) {
  const where = ['r.year = @year'];
  const p = { year };
  if (filters.deleted === '1') where.push('r.deleted = 1');
  else where.push('r.deleted = 0');
  if (filters.dept) { where.push('r.dept = @dept'); p.dept = filters.dept; }
  if (filters.process) { where.push('r.process_code = @process'); p.process = filters.process; }
  if (filters.minRisk === 'over') { where.push('r.risk >= @th'); p.th = improvementThreshold(); }
  if (filters.minRisk === 'missing') where.push('r.risk IS NULL');
  if (filters.vis) { where.push('r.visibility = @vis'); p.vis = filters.vis; }
  if (filters.status) { where.push('r.work_status = @status'); p.status = filters.status; }
  if (filters.q) {
    where.push('(r.hazard LIKE @q OR r.item_code LIKE @q OR r.current_measure LIKE @q OR r.reduction LIKE @q OR r.process_name LIKE @q)');
    p.q = `%${filters.q}%`;
  }
  return getDb()
    .prepare(`SELECT r.*, (SELECT COUNT(*) FROM photos ph WHERE ph.year = r.year AND ph.link_id = COALESCE(r.photo_link_id, r.item_code)) AS photo_count
      FROM risk_items r LEFT JOIN processes pr ON pr.year = r.year AND pr.code = r.process_code
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(pr.seq, 999), r.process_code, CAST(SUBSTR(r.item_code, INSTR(r.item_code, '-') + 1) AS INTEGER), r.item_code`)
    .all(p);
}

export function riskSummary(year) {
  const db = getDb();
  const th = improvementThreshold();
  return db
    .prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN risk >= ? THEN 1 ELSE 0 END) AS over,
        SUM(CASE WHEN visibility = '미공개' THEN 1 ELSE 0 END) AS hidden,
        SUM(CASE WHEN risk IS NULL THEN 1 ELSE 0 END) AS missing
      FROM risk_items WHERE year = ? AND deleted = 0`)
    .get(th, year);
}

export function getRisk(id) {
  return getDb().prepare('SELECT * FROM risk_items WHERE id = ?').get(id);
}

export function getPhotos(year, linkId) {
  return getDb().prepare('SELECT * FROM photos WHERE year = ? AND link_id = ? ORDER BY id').all(year, linkId);
}

export function getHistory(id) {
  return getDb().prepare("SELECT * FROM history WHERE table_name = 'risk_items' AND row_id = ? ORDER BY id DESC").all(id);
}

// 공정ID 안에서 다음 항목ID (P03-17)
export function nextItemCode(year, processCode) {
  const rows = getDb().prepare('SELECT item_code FROM risk_items WHERE year = ? AND process_code = ?').all(year, processCode);
  const max = rows.reduce((m, r) => Math.max(m, Number(r.item_code.split('-')[1]) || 0), 0);
  return `${processCode}-${max + 1}`;
}
