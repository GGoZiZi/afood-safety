'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getRisk, nextItemCode } from '@/lib/risk';
import { isClosed } from '@/lib/year';

const TEXT_FIELDS = ['space', 'process_name', 'sub_task', 'category', 'cause', 'hazard', 'legal_basis', 'pre_owner',
  'current_measure', 'reduction', 'action_owner', 'due_date', 'done_date', 'prev_action_no', 'note', 'note2', 'photo_link_id'];
const SCORE_FIELDS = ['likelihood', 'severity', 'post_likelihood', 'post_severity'];

function clean(v) {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
}

function readForm(formData) {
  const row = {};
  for (const f of TEXT_FIELDS) row[f] = clean(formData.get(f));
  for (const f of SCORE_FIELDS) {
    const n = Number(formData.get(f));
    row[f] = Number.isInteger(n) && n > 0 ? n : null;
  }
  row.risk = row.likelihood && row.severity ? row.likelihood * row.severity : null;
  row.post_risk = row.post_likelihood && row.post_severity ? row.post_likelihood * row.post_severity : null;
  row.visibility = formData.get('visibility') === '미공개' ? '미공개' : '공개';
  return row;
}

function logHistory(rowId, action, changes) {
  getDb()
    .prepare("INSERT INTO history (table_name, row_id, action, changes) VALUES ('risk_items', ?, ?, ?)")
    .run(rowId, action, changes ? JSON.stringify(changes) : null);
}

function assertOpen(year) {
  if (isClosed(year)) throw new Error(`${year}년은 마감되어 수정할 수 없습니다. 연도 관리에서 마감을 해제하세요.`);
}

export async function createRisk(formData) {
  const year = Number(formData.get('year'));
  assertOpen(year);
  const processCode = clean(formData.get('process_code'));
  if (!processCode) throw new Error('공정을 선택해 주세요.');
  const row = readForm(formData);
  if (!row.hazard) throw new Error('유해위험요인을 입력해 주세요.');
  const db = getDb();
  const proc = db.prepare('SELECT * FROM processes WHERE year = ? AND code = ?').get(year, processCode);
  const itemCode = nextItemCode(year, processCode);
  const info = db
    .prepare(`INSERT INTO risk_items (year, item_code, process_code, dept, work_status, ${Object.keys(row).join(', ')})
      VALUES (@year, @item_code, @process_code, @dept, '신규', ${Object.keys(row).map((k) => '@' + k).join(', ')})`)
    .run({
      ...row,
      year,
      item_code: itemCode,
      process_code: processCode,
      dept: proc?.dept ?? null,
      space: row.space ?? proc?.space ?? null,
      process_name: row.process_name ?? proc?.name ?? null,
      sub_task: row.sub_task ?? proc?.sub_task ?? null,
    });
  logHistory(info.lastInsertRowid, '추가', null);
  revalidatePath('/risk');
  redirect(`/risk/${info.lastInsertRowid}?saved=1`);
}

export async function updateRisk(formData) {
  const id = Number(formData.get('id'));
  const before = getRisk(id);
  if (!before) throw new Error('항목을 찾을 수 없습니다.');
  assertOpen(before.year);
  const row = readForm(formData);
  if (!row.hazard) throw new Error('유해위험요인을 입력해 주세요.');

  const changes = {};
  for (const [k, v] of Object.entries(row)) {
    if ((before[k] ?? null) !== (v ?? null)) changes[k] = [before[k] ?? null, v ?? null];
  }
  if (Object.keys(changes).length === 0) redirect(`/risk/${id}`);

  // 내용이 바뀐 "기존" 항목은 "수정"으로 표시 (공개 여부만 바꾼 경우는 제외)
  const contentChanged = Object.keys(changes).some((k) => k !== 'visibility');
  const status = before.work_status === '기존' && contentChanged ? '수정' : before.work_status;
  const sets = Object.keys(row).map((k) => `${k} = @${k}`).join(', ');
  getDb()
    .prepare(`UPDATE risk_items SET ${sets}, work_status = @status, updated_at = datetime('now','localtime') WHERE id = @id`)
    .run({ ...row, status, id });
  logHistory(id, '수정', changes);
  revalidatePath('/risk');
  redirect(`/risk/${id}?saved=1`);
}

export async function setVisibility(formData) {
  const id = Number(formData.get('id'));
  const vis = formData.get('visibility') === '미공개' ? '미공개' : '공개';
  const before = getRisk(id);
  if (!before || before.visibility === vis) return;
  assertOpen(before.year);
  getDb().prepare("UPDATE risk_items SET visibility = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(vis, id);
  logHistory(id, vis, { visibility: [before.visibility, vis] });
  revalidatePath('/risk');
  revalidatePath(`/risk/${id}`);
}

export async function setDeleted(formData) {
  const id = Number(formData.get('id'));
  const del = formData.get('deleted') === '1' ? 1 : 0;
  const before = getRisk(id);
  if (!before) return;
  assertOpen(before.year);
  getDb().prepare("UPDATE risk_items SET deleted = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(del, id);
  logHistory(id, del ? '삭제' : '복구', null);
  revalidatePath('/risk');
  redirect(del ? '/risk' : `/risk/${id}`);
}
