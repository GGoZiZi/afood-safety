'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { nextItemCode } from '@/lib/risk';
import { savePhoto } from '@/lib/upload';
import { isClosed } from '@/lib/year';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

async function addPhotos(patrolId, files) {
  const ins = getDb().prepare('INSERT INTO patrol_findings (patrol_id, photo) VALUES (?, ?)');
  let n = 0;
  for (const f of files) {
    const name = await savePhoto(f);
    if (name) { ins.run(patrolId, name); n++; }
  }
  return n;
}

// 새 순회점검: 사진 여러 장을 한 번에 올리면 사진마다 지적사항 칸이 생긴다
export async function createPatrol(formData) {
  const user = await requireUser();
  const date = clean(formData.get('date'));
  if (!date) throw new Error('점검일을 입력해 주세요.');
  const db = getDb();
  const info = db.prepare('INSERT INTO patrols (year, date, area, inspector, note) VALUES (?, ?, ?, ?, ?)')
    .run(Number(date.slice(0, 4)), date, clean(formData.get('area')), clean(formData.get('inspector')) ?? user.name, clean(formData.get('note')));
  const id = info.lastInsertRowid;
  const n = await addPhotos(id, formData.getAll('photos'));
  if (n === 0) db.prepare('INSERT INTO patrol_findings (patrol_id) VALUES (?)').run(id);
  revalidatePath('/patrol');
  redirect(`/patrol/${id}`);
}

export async function updatePatrol(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  getDb().prepare('UPDATE patrols SET date = ?, area = ?, inspector = ?, note = ? WHERE id = ?')
    .run(clean(formData.get('date')), clean(formData.get('area')), clean(formData.get('inspector')), clean(formData.get('note')), id);
  revalidatePath(`/patrol/${id}`);
}

export async function addFindingPhotos(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  const n = await addPhotos(id, formData.getAll('photos'));
  if (n === 0) getDb().prepare('INSERT INTO patrol_findings (patrol_id) VALUES (?)').run(id);
  revalidatePath(`/patrol/${id}`);
}

function findingFields(formData) {
  return {
    process_code: clean(formData.get('process_code')),
    location: clean(formData.get('location')),
    finding: clean(formData.get('finding')),
    measure: clean(formData.get('measure')),
    owner: clean(formData.get('owner')),
    due_date: clean(formData.get('due_date')),
  };
}

export async function saveFinding(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  const f = findingFields(formData);
  const db = getDb();
  db.prepare(`UPDATE patrol_findings SET process_code = @process_code, location = @location, finding = @finding, measure = @measure,
      owner = @owner, due_date = @due_date WHERE id = @id`).run({ ...f, id });
  const row = db.prepare('SELECT patrol_id FROM patrol_findings WHERE id = ?').get(id);
  revalidatePath(`/patrol/${row.patrol_id}`);
}

// 위험성평가에 "신규" 위험요인으로 등록. 사진은 그 항목의 사진으로 연결된다
export async function registerFinding(formData) {
  const user = await requireUser();
  const id = Number(formData.get('id'));
  const db = getDb();
  const f = { ...findingFields(formData) };
  const cur = db.prepare('SELECT f.*, p.year, p.date FROM patrol_findings f JOIN patrols p ON p.id = f.patrol_id WHERE f.id = ?').get(id);
  if (!cur) throw new Error('지적사항을 찾을 수 없습니다.');
  if (cur.risk_item_id) throw new Error('이미 위험성평가에 등록했습니다.');
  if (isClosed(cur.year)) throw new Error(`${cur.year}년은 마감되어 등록할 수 없습니다.`);
  if (!f.process_code) throw new Error('등록하려면 공정을 골라 주세요.');
  if (!f.finding) throw new Error('등록하려면 지적 내용(유해위험요인)을 써 주세요.');
  const L = Number(formData.get('likelihood')) || null;
  const S = Number(formData.get('severity')) || null;
  const cause = clean(formData.get('cause'));
  const category = cause ? db.prepare("SELECT label FROM codes WHERE kind = 'cause' AND code = ?").get(cause)?.label ?? null : null;
  const proc = db.prepare('SELECT * FROM processes WHERE year = ? AND code = ?').get(cur.year, f.process_code);
  db.transaction(() => {
    const code = nextItemCode(cur.year, f.process_code);
    const info = db.prepare(`INSERT INTO risk_items (year, item_code, process_code, space, dept, process_name, sub_task, category, cause, hazard,
        current_measure, likelihood, severity, risk, reduction, action_owner, due_date, photo_link_id, note, work_status, visibility)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '신규', '공개')`)
      .run(cur.year, code, f.process_code, proc?.space ?? f.location, proc?.dept ?? null, proc?.name ?? null, proc?.sub_task ?? null,
        category, cause, f.finding, clean(formData.get('current_measure')), L, S, L && S ? L * S : null, f.measure, f.owner, f.due_date,
        code, `순회점검 ${cur.date}`);
    const rid = info.lastInsertRowid;
    if (cur.photo) {
      db.prepare("INSERT INTO photos (year, link_id, kind, filename, description, taken_at) VALUES (?, ?, '현장', ?, ?, ?)")
        .run(cur.year, code, cur.photo, f.finding, cur.date);
    }
    db.prepare("INSERT INTO history (table_name, row_id, action, changes, user_name) VALUES ('risk_items', ?, '추가', ?, ?)")
      .run(rid, JSON.stringify({ note: [null, `순회점검 ${cur.date}에서 등록`] }), user.name);
    db.prepare(`UPDATE patrol_findings SET process_code = @process_code, location = @location, finding = @finding, measure = @measure,
        owner = @owner, due_date = @due_date, decision = '등록', risk_item_id = @rid WHERE id = @id`).run({ ...f, rid, id });
  })();
  revalidatePath(`/patrol/${cur.patrol_id}`);
  revalidatePath('/risk');
  revalidatePath('/improve');
}

// 등록 안 함: 위험성평가에는 올리지 않고 개선조치 목록에서만 관리
// 버튼마다 bind로 결정을 넘긴다: setFindingDecision.bind(null, '미등록')
export async function setFindingDecision(choice, formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  const decision = choice === '미등록' ? '미등록' : '미정';
  const db = getDb();
  const f = findingFields(formData);
  db.prepare(`UPDATE patrol_findings SET process_code = @process_code, location = @location, finding = @finding, measure = @measure,
      owner = @owner, due_date = @due_date, decision = @decision WHERE id = @id AND risk_item_id IS NULL`).run({ ...f, decision, id });
  const row = db.prepare('SELECT patrol_id FROM patrol_findings WHERE id = ?').get(id);
  revalidatePath(`/patrol/${row.patrol_id}`);
  revalidatePath('/improve');
}

export async function deleteFinding(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  const db = getDb();
  const row = db.prepare('SELECT patrol_id, risk_item_id FROM patrol_findings WHERE id = ?').get(id);
  if (!row) return;
  if (row.risk_item_id) throw new Error('위험성평가에 등록된 지적사항은 지울 수 없습니다. 대장에서 해당 항목을 삭제하세요.');
  db.prepare('DELETE FROM patrol_findings WHERE id = ?').run(id);
  revalidatePath(`/patrol/${row.patrol_id}`);
}
