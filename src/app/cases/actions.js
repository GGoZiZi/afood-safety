'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

const STATUS = ['검토대기', '채택', '제외'];

function fields(formData) {
  const title = clean(formData.get('title'));
  if (!title) throw new Error('제목(TBM에 들어갈 한 줄)을 입력해 주세요.');
  const depts = formData.getAll('depts').map(String).filter(Boolean);
  const status = String(formData.get('status') || '채택');
  return {
    category: clean(formData.get('category')),
    title,
    occurred_on: clean(formData.get('occurred_on')),
    share_from: clean(formData.get('share_from')),
    share_days: Math.max(1, Math.min(60, Number(formData.get('share_days')) || 7)),
    depts: depts.length === 0 || depts.includes('전체') ? '전체' : depts.join(','),
    summary: clean(formData.get('summary')),
    cause: clean(formData.get('cause')),
    prevention: clean(formData.get('prevention')),
    source: clean(formData.get('source')),
    url: clean(formData.get('url')),
    status: STATUS.includes(status) ? status : '채택',
  };
}

export async function createCase(formData) {
  await requireAdmin();
  const f = fields(formData);
  const info = getDb()
    .prepare(`INSERT INTO accident_cases (category, title, occurred_on, share_from, share_days, depts, summary, cause, prevention, source, url, status)
      VALUES (@category, @title, @occurred_on, @share_from, @share_days, @depts, @summary, @cause, @prevention, @source, @url, @status)`)
    .run(f);
  revalidatePath('/cases');
  revalidatePath('/tbm');
  redirect(`/cases/${info.lastInsertRowid}?saved=1`);
}

export async function updateCase(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const f = fields(formData);
  getDb()
    .prepare(`UPDATE accident_cases SET category = @category, title = @title, occurred_on = @occurred_on, share_from = @share_from,
      share_days = @share_days, depts = @depts, summary = @summary, cause = @cause, prevention = @prevention, source = @source,
      url = @url, status = @status WHERE id = @id`)
    .run({ ...f, id });
  revalidatePath('/cases');
  revalidatePath('/tbm');
  redirect(`/cases/${id}?saved=1`);
}

// 오늘부터 다시 7일 공유
export async function shareFromToday(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  getDb().prepare("UPDATE accident_cases SET share_from = date('now','localtime'), status = '채택' WHERE id = ?").run(id);
  getDb().prepare('DELETE FROM case_seen WHERE case_id = ?').run(id);
  revalidatePath('/cases');
  revalidatePath('/tbm');
}
