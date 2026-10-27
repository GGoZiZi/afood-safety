'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireAdmin, requireUser } from '@/lib/auth';
import { EXAM_KINDS, PPE_MOVES, RESULTS, parseRoster } from '@/lib/health';
import { today } from '@/lib/tbm';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};
const num = (v) => (clean(v) == null || Number.isNaN(Number(v)) ? null : Number(v));

// ----- 건강진단 대상자 -----

function personFields(formData) {
  const name = clean(formData.get('name'));
  if (!name) throw new Error('성명을 입력해 주세요.');
  const agents = (clean(formData.get('agents')) ?? '').split('\n').map((s) => s.trim()).filter(Boolean).join('\n') || null;
  return {
    dept: clean(formData.get('dept')),
    name,
    birth: clean(formData.get('birth')),
    sex: clean(formData.get('sex')),
    phone: clean(formData.get('phone')),
    hire_date: clean(formData.get('hire_date')),
    night_work: formData.get('night_work') ? 1 : 0,
    general: formData.get('general') ? 1 : 0,
    general_cycle: Number(formData.get('general_cycle')) === 24 ? 24 : 12,
    agents,
    special_cycle: Number(formData.get('special_cycle')) || 12,
    food_cert: formData.get('food_cert') ? 1 : 0,
    note: clean(formData.get('note')),
  };
}

export async function savePerson(formData) {
  await requireAdmin();
  const f = personFields(formData);
  const id = Number(formData.get('id'));
  const db = getDb();
  if (id) {
    db.prepare(`UPDATE health_people SET dept = @dept, name = @name, birth = @birth, sex = @sex, phone = @phone, hire_date = @hire_date,
      night_work = @night_work, general = @general, general_cycle = @general_cycle, agents = @agents, special_cycle = @special_cycle,
      food_cert = @food_cert, note = @note WHERE id = @id`).run({ ...f, id });
    revalidatePath('/health');
    redirect(`/health/${id}?saved=1`);
  }
  const info = db.prepare(`INSERT INTO health_people (dept, name, birth, sex, phone, hire_date, night_work, general, general_cycle, agents, special_cycle, food_cert, note)
    VALUES (@dept, @name, @birth, @sex, @phone, @hire_date, @night_work, @general, @general_cycle, @agents, @special_cycle, @food_cert, @note)`).run(f);
  revalidatePath('/health');
  redirect(`/health/${info.lastInsertRowid}?saved=1`);
}

// 퇴사 등으로 명단에서 빼기 (검진 기록은 남는다)
export async function setPersonActive(formData) {
  await requireAdmin();
  getDb().prepare('UPDATE health_people SET active = ? WHERE id = ?').run(formData.get('active') === '1' ? 1 : 0, Number(formData.get('id')));
  revalidatePath('/health');
  redirect('/health');
}

// 기존 "건강진단 설계" 명단 엑셀. 검진일을 넣으면 명단의 O 표시대로 검진 기록도 만든다
export async function importRoster(formData) {
  const user = await requireAdmin();
  const file = formData.get('file');
  if (!file || !file.size) throw new Error('엑셀 파일을 골라 주세요.');
  const people = parseRoster(Buffer.from(await file.arrayBuffer()));
  const examDate = clean(formData.get('exam_date'));
  const agency = clean(formData.get('agency'));
  const db = getDb();
  const find = db.prepare('SELECT id FROM health_people WHERE name = ? AND (birth IS ? OR birth = ?)');
  const ins = db.prepare(`INSERT INTO health_people (dept, name, birth, sex, phone, hire_date, night_work, general, agents, food_cert)
    VALUES (@dept, @name, @birth, @sex, @phone, @hire_date, @night_work, @general, @agents, @food_cert)`);
  const upd = db.prepare(`UPDATE health_people SET dept = @dept, sex = COALESCE(@sex, sex), phone = COALESCE(@phone, phone),
    hire_date = COALESCE(@hire_date, hire_date), night_work = @night_work, general = @general, agents = @agents, food_cert = @food_cert, active = 1 WHERE id = @id`);
  const exam = db.prepare('INSERT OR IGNORE INTO health_exams (person_id, kind, date, agency, created_by) VALUES (?, ?, ?, ?, ?)');
  let added = 0, updated = 0, exams = 0;
  db.transaction(() => {
    for (const p of people) {
      const row = find.get(p.name, p.birth, p.birth);
      let id;
      if (row) { upd.run({ ...p, id: row.id }); id = row.id; updated++; }
      else { id = ins.run(p).lastInsertRowid; added++; }
      if (examDate) {
        const kinds = [p.general && '일반', (p.agents || p.night_work) && '특수', p.food_cert && '보건증'].filter(Boolean);
        for (const k of kinds) exams += exam.run(id, k, examDate, agency, user.name).changes;
      }
    }
  })();
  revalidatePath('/health');
  redirect(`/health?imported=${added}-${updated}-${exams}`);
}

// ----- 검진 기록 -----

export async function addExam(formData) {
  const user = await requireAdmin();
  const id = Number(formData.get('person_id'));
  const date = clean(formData.get('date'));
  if (!date) throw new Error('검진일을 입력해 주세요.');
  const kind = String(formData.get('kind'));
  if (!EXAM_KINDS.includes(kind)) throw new Error('검진 종류를 골라 주세요.');
  const result = clean(formData.get('result'));
  getDb()
    .prepare(`INSERT INTO health_exams (person_id, kind, date, agency, result, followup, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (person_id, kind, date) DO UPDATE SET agency = excluded.agency, result = excluded.result, followup = excluded.followup`)
    .run(id, kind, date, clean(formData.get('agency')), RESULTS.includes(result) ? result : null, clean(formData.get('followup')), user.name);
  revalidatePath('/health');
  redirect(`/health/${id}?saved=1`);
}

// 판정·사후관리 고치기. done: 사후관리를 끝냈는지
export async function updateExam(done, formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const result = clean(formData.get('result'));
  const e = getDb().prepare('SELECT person_id FROM health_exams WHERE id = ?').get(id);
  getDb()
    .prepare('UPDATE health_exams SET result = ?, followup = ?, followup_done = ? WHERE id = ?')
    .run(RESULTS.includes(result) ? result : null, clean(formData.get('followup')), done ? 1 : 0, id);
  revalidatePath('/health');
  redirect(`/health/${e.person_id}?saved=1`);
}

export async function deleteExam(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const e = getDb().prepare('SELECT person_id FROM health_exams WHERE id = ?').get(id);
  getDb().prepare('DELETE FROM health_exams WHERE id = ?').run(id);
  revalidatePath('/health');
  redirect(`/health/${e.person_id}`);
}

// ----- 작업환경측정 -----

export async function saveMeasurement(formData) {
  await requireAdmin();
  const date = clean(formData.get('date'));
  if (!date) throw new Error('측정일을 입력해 주세요.');
  const half = formData.get('half') === '하반기' ? '하반기' : '상반기';
  const info = getDb()
    .prepare(`INSERT INTO measurements (year, half, date, agency, note) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (year, half) DO UPDATE SET date = excluded.date, agency = excluded.agency, note = excluded.note RETURNING id`)
    .get(Number(date.slice(0, 4)), half, date, clean(formData.get('agency')), clean(formData.get('note')));
  revalidatePath('/health/measure');
  redirect(`/health/measure?m=${info.id}#m${info.id}`);
}

export async function deleteMeasurement(formData) {
  await requireAdmin();
  getDb().prepare('DELETE FROM measurements WHERE id = ?').run(Number(formData.get('id')));
  revalidatePath('/health/measure');
  redirect('/health/measure');
}

// 결과 여러 줄을 한 번에: "부서·공정 | 유해인자 | 측정치 | 노출기준 | 단위"
export async function addResults(formData) {
  await requireAdmin();
  const mid = Number(formData.get('measurement_id'));
  const lines = String(formData.get('lines') ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const ins = getDb().prepare('INSERT INTO measurement_results (measurement_id, place, agent, value, limit_value, unit) VALUES (?, ?, ?, ?, ?, ?)');
  getDb().transaction(() => {
    for (const l of lines) {
      const [place, agent, value, limit, unit] = l.split(/\s*[|\t]\s*/);
      if (!agent) continue;
      ins.run(mid, clean(place), agent.trim(), num(value), num(limit), clean(unit));
    }
  })();
  revalidatePath('/health/measure');
  redirect(`/health/measure?m=${mid}#m${mid}`);
}

export async function deleteResult(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const r = getDb().prepare('SELECT measurement_id FROM measurement_results WHERE id = ?').get(id);
  getDb().prepare('DELETE FROM measurement_results WHERE id = ?').run(id);
  revalidatePath('/health/measure');
  redirect(`/health/measure?m=${r.measurement_id}#m${r.measurement_id}`);
}

// 측정 주기: 보통 6개월, 2회 연속 노출기준 미만이면 12개월로 늘릴 수 있다
export async function setMeasureCycle(formData) {
  await requireAdmin();
  const v = Number(formData.get('cycle')) === 12 ? '12' : '6';
  getDb().prepare("INSERT INTO settings (key, value) VALUES ('measure_cycle_months', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(v);
  revalidatePath('/health/measure');
}

// ----- 보호구 -----

export async function savePpeItem(formData) {
  await requireAdmin();
  const name = clean(formData.get('name'));
  if (!name) throw new Error('품목명을 입력해 주세요.');
  const f = {
    name, kind: clean(formData.get('kind')), cert_no: clean(formData.get('cert_no')),
    replace_months: Number(formData.get('replace_months')) || null, min_stock: Number(formData.get('min_stock')) || 0, note: clean(formData.get('note')),
  };
  const id = Number(formData.get('id'));
  if (id) getDb().prepare(`UPDATE ppe_items SET name = @name, kind = @kind, cert_no = @cert_no, replace_months = @replace_months,
    min_stock = @min_stock, note = @note WHERE id = @id`).run({ ...f, id });
  else getDb().prepare(`INSERT INTO ppe_items (name, kind, cert_no, replace_months, min_stock, note)
    VALUES (@name, @kind, @cert_no, @replace_months, @min_stock, @note)`).run(f);
  revalidatePath('/health/ppe');
  redirect('/health/ppe?saved=1');
}

export async function setPpeActive(formData) {
  await requireAdmin();
  getDb().prepare('UPDATE ppe_items SET active = 0 WHERE id = ?').run(Number(formData.get('id')));
  revalidatePath('/health/ppe');
  redirect('/health/ppe');
}

// 입고·지급·폐기. 현장 관리감독자도 지급을 적을 수 있다
export async function addPpeMove(formData) {
  const user = await requireUser();
  const kind = String(formData.get('kind'));
  if (!PPE_MOVES.includes(kind)) throw new Error('입고·지급·폐기 중에서 골라 주세요.');
  if (kind !== '지급' && user.role !== 'admin') throw new Error('입고·폐기는 관리자만 적을 수 있습니다.');
  const qty = Number(formData.get('qty'));
  if (!(qty > 0)) throw new Error('수량을 입력해 주세요.');
  const person = clean(formData.get('person'));
  if (kind === '지급' && !person) throw new Error('받은 사람을 입력해 주세요.');
  getDb()
    .prepare('INSERT INTO ppe_moves (item_id, date, kind, qty, person, dept, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(Number(formData.get('item_id')), clean(formData.get('date')) ?? today(), kind, qty, person,
      clean(formData.get('dept')) ?? (user.role === 'admin' ? null : user.dept), clean(formData.get('note')), user.name);
  revalidatePath('/health/ppe');
  redirect('/health/ppe?moved=1');
}

export async function deletePpeMove(formData) {
  await requireAdmin();
  getDb().prepare('DELETE FROM ppe_moves WHERE id = ?').run(Number(formData.get('id')));
  revalidatePath('/health/ppe');
  redirect('/health/ppe');
}
