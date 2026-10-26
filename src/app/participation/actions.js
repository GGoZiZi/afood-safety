'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireAdmin, requireUser } from '@/lib/auth';
import { importParticipationWorkbook } from '@/lib/participation';
import { isClosed } from '@/lib/year';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

export async function importParticipation(formData) {
  await requireAdmin();
  const year = Number(formData.get('year'));
  const file = formData.get('file');
  if (!file || typeof file === 'string' || !file.size) throw new Error('엑셀 파일을 골라 주세요.');
  const r = importParticipationWorkbook(Buffer.from(await file.arrayBuffer()), year);
  revalidatePath('/participation');
  redirect(`/participation?imported=${r.workers}-${r.processes}-${r.translations}-${r.scores}`);
}

export async function addParticipant(formData) {
  await requireUser();
  const year = Number(formData.get('year'));
  const name = clean(formData.get('name'));
  if (!name) throw new Error('이름을 입력해 주세요.');
  const db = getDb();
  const dept = clean(formData.get('dept')) ?? db.prepare('SELECT dept FROM tbm_members WHERE name = ? AND active = 1').get(name)?.dept ?? null;
  const row = db.prepare(`INSERT INTO participants (year, name, lang, dept) VALUES (?, ?, ?, ?)
    ON CONFLICT (year, name) DO UPDATE SET lang = excluded.lang RETURNING id`).get(year, name, String(formData.get('lang') || 'ko'), dept);
  redirect(`/participation/${row.id}`);
}

export async function saveParticipant(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  const db = getDb();
  const procs = formData.getAll('procs').map(String);
  db.transaction(() => {
    db.prepare('UPDATE participants SET lang = ?, dept = ? WHERE id = ?').run(String(formData.get('lang') || 'ko'), clean(formData.get('dept')), id);
    db.prepare('DELETE FROM participant_processes WHERE participant_id = ?').run(id);
    const ins = db.prepare('INSERT INTO participant_processes (participant_id, process_code) VALUES (?, ?)');
    for (const p of procs) ins.run(id, p);
  })();
  revalidatePath(`/participation/${id}`);
}

// 근로자가 종이에 적은 점수·의견을 옮겨 적는다
function writeScores(id, formData) {
  const db = getDb();
  const up = db.prepare(`INSERT INTO participation_scores (participant_id, risk_item_id, likelihood, severity, opinion, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT (participant_id, risk_item_id) DO UPDATE SET likelihood = excluded.likelihood, severity = excluded.severity,
      opinion = excluded.opinion, updated_at = excluded.updated_at`);
  const del = db.prepare('DELETE FROM participation_scores WHERE participant_id = ? AND risk_item_id = ? AND reflected = 0');
  db.transaction(() => {
    for (const rid of formData.getAll('item').map(Number)) {
      const L = Number(formData.get(`l_${rid}`)) || null;
      const S = Number(formData.get(`s_${rid}`)) || null;
      const op = clean(formData.get(`o_${rid}`));
      if (L || S || op) up.run(id, rid, L, S, op);
      else del.run(id, rid);
    }
  })();
}

export async function saveScores(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  writeScores(id, formData);
  revalidatePath(`/participation/${id}`);
  revalidatePath('/participation');
}

// 근로자 점수를 위험성평가 점수로 반영 (이력에 남는다)
// 행마다 bind로 항목 id를 넘긴다: reflectScore.bind(null, riskItemId)
export async function reflectScore(riskItemId, formData) {
  const user = await requireUser();
  const id = Number(formData.get('id'));
  const rid = Number(riskItemId);
  writeScores(id, formData); // 화면에서 고친 점수를 먼저 저장
  const db = getDb();
  const s = db.prepare('SELECT s.*, p.name FROM participation_scores s JOIN participants p ON p.id = s.participant_id WHERE s.participant_id = ? AND s.risk_item_id = ?').get(id, rid);
  const r = db.prepare('SELECT * FROM risk_items WHERE id = ?').get(rid);
  if (!s || !r || !s.likelihood || !s.severity) throw new Error('반영할 근로자 점수가 없습니다. 먼저 점수를 저장해 주세요.');
  if (isClosed(r.year)) throw new Error(`${r.year}년은 마감되어 수정할 수 없습니다.`);
  const risk = s.likelihood * s.severity;
  db.transaction(() => {
    db.prepare(`UPDATE risk_items SET likelihood = ?, severity = ?, risk = ?, work_status = CASE WHEN work_status = '기존' THEN '수정' ELSE work_status END,
        updated_at = datetime('now','localtime') WHERE id = ?`).run(s.likelihood, s.severity, risk, rid);
    db.prepare("INSERT INTO history (table_name, row_id, action, changes, user_name) VALUES ('risk_items', ?, ?, ?, ?)")
      .run(rid, `근로자 의견 반영 (${s.name})`, JSON.stringify({ likelihood: [r.likelihood, s.likelihood], severity: [r.severity, s.severity], risk: [r.risk, risk] }), user.name);
    db.prepare('UPDATE participation_scores SET reflected = 1 WHERE participant_id = ? AND risk_item_id = ?').run(id, rid);
  })();
  revalidatePath(`/participation/${id}`);
  revalidatePath('/risk');
}

export async function deleteParticipant(formData) {
  await requireAdmin();
  getDb().prepare('DELETE FROM participants WHERE id = ?').run(Number(formData.get('id')));
  revalidatePath('/participation');
  redirect('/participation');
}
