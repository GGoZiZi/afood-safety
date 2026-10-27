import { getDb } from './db';
import { addDays, today } from './tbm';

export const CERT_TYPES = ['안전인증', '자율안전확인', '안전검사', '해당없음'];
export const INSPECT_KINDS = ['정기점검', '안전검사', '수리', '기타'];
export const RESULTS = ['양호', '보완필요', '불량'];
export const SOON_DAYS = 30;

export function addMonths(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

// 다음 점검일 = 마지막 점검일(없으면 설치일) + 점검주기
export function nextDue(e) {
  const base = e.last_date ?? e.install_date;
  if (!e.cycle_months || !base) return null;
  return addMonths(base, e.cycle_months);
}

export function equipmentStatus(e, now = today()) {
  if (!e.cycle_months) return '주기 미설정';
  const due = nextDue(e);
  if (!due) return '첫 점검 필요';
  if (due < now) return '지연';
  if (due <= addDays(now, SOON_DAYS)) return '예정';
  return '정상';
}
export const EQ_STATUS = ['지연', '예정', '첫 점검 필요', '주기 미설정', '정상'];
export const EQ_CHIP = { 지연: 'hidden', 예정: 'edit', '첫 점검 필요': 'edit', '주기 미설정': 'old', 정상: 'ok' };

export function listEquipment() {
  const now = today();
  return getDb()
    .prepare(`SELECT e.*,
        (SELECT MAX(date) FROM equipment_inspections i WHERE i.equipment_id = e.id AND i.kind != '수리') AS last_date,
        (SELECT result FROM equipment_inspections i WHERE i.equipment_id = e.id AND i.kind != '수리' ORDER BY date DESC, id DESC LIMIT 1) AS last_result,
        (SELECT COUNT(*) FROM documents d WHERE d.owner_kind = 'equipment' AND d.owner_id = e.id) AS docs
      FROM equipment e WHERE e.active = 1 ORDER BY e.location, e.name`)
    .all()
    .map((e) => ({ ...e, next_due: nextDue(e), status: equipmentStatus(e, now) }));
}

export function getEquipment(id) {
  const e = getDb()
    .prepare(`SELECT e.*, (SELECT MAX(date) FROM equipment_inspections i WHERE i.equipment_id = e.id AND i.kind != '수리') AS last_date
      FROM equipment e WHERE e.id = ?`)
    .get(id);
  return e ? { ...e, next_due: nextDue(e), status: equipmentStatus(e) } : null;
}

export function listDocuments(kind, ownerId) {
  return getDb()
    .prepare(`SELECT * FROM documents WHERE owner_kind = ? AND (owner_id IS ? OR owner_id = ?) ORDER BY COALESCE(effective_on, uploaded_at) DESC, id DESC`)
    .all(kind, ownerId ?? null, ownerId ?? null);
}
