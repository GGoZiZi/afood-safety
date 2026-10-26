'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { canEditDept, requireAdmin, requireUser } from '@/lib/auth';
import { ATTEND_STATUS, autoCaseText } from '@/lib/tbm';

function loadMeeting(id) {
  const m = getDb().prepare('SELECT * FROM tbm_meetings WHERE id = ?').get(id);
  if (!m) throw new Error('TBM 회의록을 찾을 수 없습니다.');
  return m;
}

async function editable(id) {
  const user = await requireUser();
  const m = loadMeeting(id);
  if (!canEditDept(user, m.dept)) throw new Error(`${m.dept} TBM은 해당 부서 관리감독자와 관리자만 고칠 수 있습니다.`);
  return { user, m };
}

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

function log(meetingId, user, action, detail) {
  getDb().prepare('INSERT INTO tbm_history (meeting_id, user_name, action, detail) VALUES (?, ?, ?, ?)').run(meetingId, user.name, action, detail ?? null);
}

// 저장 (완료된 회의록은 먼저 "수정"을 눌러 다시 열어야 한다)
export async function saveMeeting(formData) {
  const id = Number(formData.get('id'));
  const { user, m } = await editable(id);
  if (m.status === '완료') throw new Error('완료된 회의록입니다. "수정하기"를 누른 뒤 고쳐 주세요.');
  const db = getDb();
  const caseText = clean(formData.get('case_text'));
  db.transaction(() => {
    db.prepare(`UPDATE tbm_meetings SET time_text = ?, work_name = ?, work_content = ?, place = ?, ra_done = ?,
        near_miss = ?, case_text = ?, special_note = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(
        clean(formData.get('time_text')), clean(formData.get('work_name')), clean(formData.get('work_content')),
        clean(formData.get('place')), formData.get('ra_done') === '1' ? 1 : 0, clean(formData.get('near_miss')),
        // 자동 문구를 손대지 않았으면 비워 둬서 재해사례가 바뀌면 같이 바뀌게 한다
        caseText === clean(autoCaseText(m.dept, m.date)) ? null : caseText,
        clean(formData.get('special_note')), id,
      );
    const upItem = db.prepare(`INSERT INTO tbm_items (meeting_id, slot, risk_item_id, hazard, measure) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (meeting_id, slot) DO UPDATE SET risk_item_id = excluded.risk_item_id, hazard = excluded.hazard, measure = excluded.measure`);
    const delItem = db.prepare('DELETE FROM tbm_items WHERE meeting_id = ? AND slot = ?');
    for (let slot = 1; slot <= 4; slot++) {
      const hazard = clean(formData.get(`hazard_${slot}`));
      if (!hazard) { delItem.run(id, slot); continue; }
      upItem.run(id, slot, Number(formData.get(`risk_${slot}`)) || null, hazard, clean(formData.get(`measure_${slot}`)));
    }
    const upAtt = db.prepare('UPDATE tbm_attendance SET status = ? WHERE meeting_id = ? AND name = ?');
    for (const [k, v] of formData.entries()) {
      if (k.startsWith('att:') && ATTEND_STATUS.includes(v)) upAtt.run(v, id, k.slice(4));
    }
    const extra = clean(formData.get('add_attendee'));
    if (extra) {
      const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM tbm_attendance WHERE meeting_id = ?').get(id).s;
      db.prepare("INSERT OR IGNORE INTO tbm_attendance (meeting_id, name, status, sort) VALUES (?, ?, '참석', ?)").run(id, extra, sort);
    }
    log(id, user, '저장');
  })();
  revalidatePath('/tbm');
  redirect(`/tbm/${encodeURIComponent(m.dept)}/${m.date}?saved=1`);
}

export async function removeAttendee(formData) {
  const id = Number(formData.get('id'));
  const { user, m } = await editable(id);
  if (m.status === '완료') throw new Error('완료된 회의록입니다.');
  const name = String(formData.get('name'));
  getDb().prepare('DELETE FROM tbm_attendance WHERE meeting_id = ? AND name = ?').run(id, name);
  log(id, user, '참석자 빼기', name);
  revalidatePath(`/tbm/${encodeURIComponent(m.dept)}/${m.date}`);
}

// 완료: 그 시점의 사고사례 문구를 고정해서 기록으로 남긴다
export async function completeMeeting(formData) {
  const id = Number(formData.get('id'));
  const { user, m } = await editable(id);
  getDb()
    .prepare(`UPDATE tbm_meetings SET status = '완료', case_text = COALESCE(case_text, ?), completed_at = datetime('now','localtime'),
      completed_by = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(clean(autoCaseText(m.dept, m.date)), user.name, id);
  log(id, user, '완료');
  revalidatePath('/tbm');
  redirect(`/tbm/${encodeURIComponent(m.dept)}/${m.date}`);
}

export async function reopenMeeting(formData) {
  const id = Number(formData.get('id'));
  const { user, m } = await editable(id);
  getDb().prepare("UPDATE tbm_meetings SET status = '작성중', updated_at = datetime('now','localtime') WHERE id = ?").run(id);
  log(id, user, '수정하기 (완료 취소)');
  revalidatePath('/tbm');
  redirect(`/tbm/${encodeURIComponent(m.dept)}/${m.date}`);
}

// 재해사례 알림 확인
export async function markCasesSeen(formData) {
  const user = await requireUser();
  const ids = String(formData.get('ids') || '').split(',').map(Number).filter(Boolean);
  const ins = getDb().prepare('INSERT OR IGNORE INTO case_seen (user_id, case_id) VALUES (?, ?)');
  for (const cid of ids) ins.run(user.id, cid);
  revalidatePath('/tbm');
}

// ===== TBM 설정 (관리자) =====

export async function saveDept(formData) {
  await requireAdmin();
  const code = String(formData.get('code'));
  const days = formData.getAll('weekdays').map(Number).filter((n) => n >= 1 && n <= 7).sort().join(',');
  getDb()
    .prepare('UPDATE tbm_depts SET place = ?, work_name = ?, leader_affil = ?, leader_title = ?, leader_name = ?, weekdays = ? WHERE code = ?')
    .run(clean(formData.get('place')), clean(formData.get('work_name')), clean(formData.get('leader_affil')),
      clean(formData.get('leader_title')), clean(formData.get('leader_name')), days || '1,2,3,4,5', code);
  revalidatePath('/tbm/settings');
}

export async function addDept(formData) {
  await requireAdmin();
  const code = clean(formData.get('code'));
  if (!code) throw new Error('부서 이름을 입력해 주세요.');
  const db = getDb();
  const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM tbm_depts').get().s;
  db.prepare('INSERT INTO tbm_depts (code, sort, place) VALUES (?, ?, ?)').run(code, sort, code);
  revalidatePath('/tbm/settings');
}

export async function saveMember(formData) {
  await requireAdmin();
  const db = getDb();
  const id = Number(formData.get('id')) || null;
  const name = clean(formData.get('name'));
  const lang = String(formData.get('lang') || 'ko');
  if (id) {
    const active = formData.get('active') === '1' ? 1 : 0;
    db.prepare('UPDATE tbm_members SET name = COALESCE(?, name), lang = ?, active = ? WHERE id = ?').run(name, lang, active, id);
  } else if (name) {
    const dept = String(formData.get('dept'));
    const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM tbm_members WHERE dept = ?').get(dept).s;
    db.prepare(`INSERT INTO tbm_members (dept, name, lang, sort) VALUES (?, ?, ?, ?)
      ON CONFLICT (dept, name) DO UPDATE SET active = 1, lang = excluded.lang`).run(dept, name, lang, sort);
  }
  revalidatePath('/tbm/settings');
}

export async function saveRules(formData) {
  await requireAdmin();
  const rules = String(formData.get('rules') || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value) VALUES ('tbm_rules', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(rules));
  db.prepare("INSERT INTO settings (key, value) VALUES ('tbm_time', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(clean(formData.get('tbm_time')) ?? '07:45 ~ 08:00');
  revalidatePath('/tbm/settings');
}

export async function setProcessDept(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  getDb().prepare('UPDATE processes SET tbm_dept = ? WHERE id = ?').run(clean(formData.get('tbm_dept')), id);
  revalidatePath('/tbm/settings');
}
