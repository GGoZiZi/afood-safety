'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';

export async function setYear(formData) {
  const jar = await cookies();
  jar.set('year', String(Number(formData.get('year'))), { maxAge: 60 * 60 * 24 * 365, path: '/' });
  revalidatePath('/', 'layout');
}

// 새 평가연도를 만들고, 고른 연도의 공정·위험요인을 "기존" 상태로 복사한다.
// 점수·감소대책은 그대로 가져오고, 조치예정일·완료일은 비워 새로 계획하게 한다.
export async function createYear(formData) {
  const year = Number(formData.get('year'));
  const from = Number(formData.get('from')) || null;
  if (!year || year < 2000 || year > 2100) throw new Error('연도를 확인해 주세요.');
  const db = getDb();
  if (db.prepare('SELECT 1 FROM years WHERE year = ?').get(year)) throw new Error(`${year}년은 이미 있습니다.`);

  db.transaction(() => {
    db.prepare('INSERT INTO years (year, title) VALUES (?, ?)').run(year, `${year}년 정기위험성평가`);
    if (from) {
      db.prepare(`INSERT INTO processes (year, code, seq, space, dept, name, sub_task, equipment, material, owner, promoter, note, work_status, extra)
        SELECT ?, code, seq, space, dept, name, sub_task, equipment, material, owner, promoter, note, '기존', extra
        FROM processes WHERE year = ? AND work_status != '삭제'`).run(year, from);
      db.prepare(`INSERT INTO risk_items (year, item_code, process_code, space, dept, process_name, sub_task, category, cause, hazard,
          legal_basis, pre_owner, current_measure, likelihood, severity, risk, reduction, post_likelihood, post_severity, post_risk,
          action_owner, prev_action_no, note, note2, photo_link_id, work_status, visibility)
        SELECT ?, item_code, process_code, space, dept, process_name, sub_task, category, cause, hazard,
          legal_basis, pre_owner, current_measure, likelihood, severity, risk, reduction, post_likelihood, post_severity, post_risk,
          action_owner, prev_action_no, note, note2, photo_link_id, '기존', visibility
        FROM risk_items WHERE year = ? AND deleted = 0`).run(year, from);
      db.prepare(`INSERT INTO photos (year, link_id, kind, filename, description, taken_at, note)
        SELECT ?, link_id, kind, filename, description, taken_at, note FROM photos WHERE year = ?`).run(year, from);
    }
  })();

  const jar = await cookies();
  jar.set('year', String(year), { maxAge: 60 * 60 * 24 * 365, path: '/' });
  revalidatePath('/', 'layout');
  redirect('/years');
}

export async function toggleClosed(formData) {
  const year = Number(formData.get('year'));
  getDb().prepare('UPDATE years SET closed = 1 - closed WHERE year = ?').run(year);
  revalidatePath('/', 'layout');
}
