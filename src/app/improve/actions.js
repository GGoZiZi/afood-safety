'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getRisk } from '@/lib/risk';
import { savePhoto } from '@/lib/upload';
import { isClosed } from '@/lib/year';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};
const score = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// 위험요인의 감소대책·담당·예정일·완료일·개선 후 점수 저장 (+ 개선 후 사진)
export async function saveRiskImprovement(formData) {
  const user = await requireUser();
  const id = Number(formData.get('id'));
  const before = getRisk(id);
  if (!before) throw new Error('항목을 찾을 수 없습니다.');
  if (isClosed(before.year)) throw new Error(`${before.year}년은 마감되어 수정할 수 없습니다.`);
  const pl = score(formData.get('post_likelihood'));
  const ps = score(formData.get('post_severity'));
  const row = {
    reduction: clean(formData.get('reduction')),
    action_owner: clean(formData.get('action_owner')),
    due_date: clean(formData.get('due_date')),
    done_date: clean(formData.get('done_date')),
    post_likelihood: pl,
    post_severity: ps,
    post_risk: pl && ps ? pl * ps : null,
  };
  const changes = {};
  for (const [k, v] of Object.entries(row)) if ((before[k] ?? null) !== v) changes[k] = [before[k] ?? null, v];
  const db = getDb();
  const photo = await savePhoto(formData.get('after_photo'));
  db.transaction(() => {
    if (Object.keys(changes).length) {
      db.prepare(`UPDATE risk_items SET reduction = @reduction, action_owner = @action_owner, due_date = @due_date, done_date = @done_date,
          post_likelihood = @post_likelihood, post_severity = @post_severity, post_risk = @post_risk,
          work_status = CASE WHEN work_status = '기존' THEN '수정' ELSE work_status END, updated_at = datetime('now','localtime') WHERE id = @id`)
        .run({ ...row, id });
      db.prepare("INSERT INTO history (table_name, row_id, action, changes, user_name) VALUES ('risk_items', ?, '개선조치', ?, ?)")
        .run(id, JSON.stringify(changes), user.name);
    }
    if (photo) {
      const link = before.photo_link_id || before.item_code;
      if (!before.photo_link_id) db.prepare('UPDATE risk_items SET photo_link_id = ? WHERE id = ?').run(link, id);
      db.prepare("INSERT INTO photos (year, link_id, kind, filename, description, taken_at) VALUES (?, ?, '개선후', ?, ?, date('now','localtime'))")
        .run(before.year, link, photo, clean(formData.get('photo_note')) ?? row.reduction);
    }
  })();
  revalidatePath('/improve');
  revalidatePath(`/risk/${id}`);
}

// 위험성평가에 등록하지 않은 순회점검 지적사항의 조치 저장
export async function saveFindingImprovement(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  const photo = await savePhoto(formData.get('after_photo'));
  getDb()
    .prepare(`UPDATE patrol_findings SET measure = ?, owner = ?, due_date = ?, done_date = ?, after_photo = COALESCE(?, after_photo) WHERE id = ?`)
    .run(clean(formData.get('measure')), clean(formData.get('owner')), clean(formData.get('due_date')), clean(formData.get('done_date')), photo, id);
  revalidatePath('/improve');
  revalidatePath('/patrol');
}
