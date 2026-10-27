'use server';

import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireAdmin, requireUser } from '@/lib/auth';
import { CERT_TYPES, INSPECT_KINDS, RESULTS } from '@/lib/equipment';
import { savePhoto } from '@/lib/upload';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

function fields(formData) {
  const name = clean(formData.get('name'));
  if (!name) throw new Error('설비명을 입력해 주세요.');
  const cert = String(formData.get('cert_type') || '해당없음');
  return {
    name,
    location: clean(formData.get('location')),
    maker: clean(formData.get('maker')),
    model: clean(formData.get('model')),
    serial_no: clean(formData.get('serial_no')),
    cert_type: CERT_TYPES.includes(cert) ? cert : '해당없음',
    cert_no: clean(formData.get('cert_no')),
    install_date: clean(formData.get('install_date')),
    cycle_months: Number(formData.get('cycle_months')) || null,
    owner: clean(formData.get('owner')),
    process_code: clean(formData.get('process_code')),
    note: clean(formData.get('note')),
  };
}

export async function createEquipment(formData) {
  await requireUser();
  const f = fields(formData);
  const photo = await savePhoto(formData.get('photo'));
  const info = getDb()
    .prepare(`INSERT INTO equipment (name, location, maker, model, serial_no, cert_type, cert_no, install_date, cycle_months, owner, process_code, note, photo)
      VALUES (@name, @location, @maker, @model, @serial_no, @cert_type, @cert_no, @install_date, @cycle_months, @owner, @process_code, @note, @photo)`)
    .run({ ...f, photo });
  revalidatePath('/equipment');
  redirect(`/equipment/${info.lastInsertRowid}?saved=1`);
}

export async function updateEquipment(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  const f = fields(formData);
  const photo = await savePhoto(formData.get('photo'));
  getDb()
    .prepare(`UPDATE equipment SET name = @name, location = @location, maker = @maker, model = @model, serial_no = @serial_no,
      cert_type = @cert_type, cert_no = @cert_no, install_date = @install_date, cycle_months = @cycle_months, owner = @owner,
      process_code = @process_code, note = @note, photo = COALESCE(@photo, photo) WHERE id = @id`)
    .run({ ...f, photo, id });
  revalidatePath('/equipment');
  redirect(`/equipment/${id}?saved=1`);
}

// 폐기·이전 등으로 목록에서 빼기 (기록은 남는다)
export async function setEquipmentActive(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  getDb().prepare('UPDATE equipment SET active = ? WHERE id = ?').run(formData.get('active') === '1' ? 1 : 0, id);
  revalidatePath('/equipment');
  redirect('/equipment');
}

export async function addInspection(formData) {
  const user = await requireUser();
  const id = Number(formData.get('id'));
  const date = clean(formData.get('date'));
  if (!date) throw new Error('점검일을 입력해 주세요.');
  const kind = String(formData.get('kind'));
  const result = String(formData.get('result'));
  const photo = await savePhoto(formData.get('photo'));
  getDb()
    .prepare(`INSERT INTO equipment_inspections (equipment_id, date, kind, inspector, result, note, photo, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, date, INSPECT_KINDS.includes(kind) ? kind : '정기점검', clean(formData.get('inspector')) ?? user.name,
      RESULTS.includes(result) ? result : '양호', clean(formData.get('note')), photo, user.name);
  revalidatePath('/equipment');
  revalidatePath(`/equipment/${id}`);
}

export async function deleteInspection(formData) {
  await requireUser();
  const db = getDb();
  const row = db.prepare('SELECT equipment_id FROM equipment_inspections WHERE id = ?').get(Number(formData.get('id')));
  if (!row) return;
  db.prepare('DELETE FROM equipment_inspections WHERE id = ?').run(Number(formData.get('id')));
  revalidatePath(`/equipment/${row.equipment_id}`);
}

// "자율안전인증리스트" 엑셀 가져오기: 머리글에 "설비명"이 있는 줄부터 읽는다. 같은 장소·설비명은 건너뛴다
export async function importEquipment(formData) {
  await requireAdmin();
  const file = formData.get('file');
  if (!file || typeof file === 'string' || !file.size) throw new Error('엑셀 파일을 골라 주세요.');
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: false });
  const h = rows.findIndex((r) => r.some((c) => String(c ?? '').includes('설비명')));
  if (h < 0) throw new Error('머리글에 "설비명" 칸이 있는 엑셀이 아닙니다.');
  const col = (re) => rows[h].findIndex((c) => re.test(String(c ?? '')));
  const C = { loc: col(/장소/), maker: col(/업체|제조/), name: col(/설비명/), model: col(/모델/), mark: col(/인증|확인/), cycle: col(/주기/), install: col(/설치/) };
  const v = (r, i) => (i >= 0 ? clean(r[i]) : null);
  const owner = clean(formData.get('owner'));
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM equipment WHERE name = ? AND IFNULL(location, \'\') = IFNULL(?, \'\')');
  const ins = db.prepare(`INSERT INTO equipment (name, location, maker, model, cert_type, cycle_months, install_date, owner)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  let added = 0;
  let skipped = 0;
  db.transaction(() => {
    for (const r of rows.slice(h + 1)) {
      const name = v(r, C.name)?.replace(/\s+/g, ' ');
      if (!name || name.startsWith('#')) continue;
      const loc = v(r, C.loc);
      if (exists.get(name, loc)) { skipped++; continue; }
      const mark = v(r, C.mark);
      ins.run(name, loc, v(r, C.maker), v(r, C.model), mark && /^(o|O|○|●|y|Y|예)$/.test(mark) ? '자율안전확인' : '해당없음',
        Number(v(r, C.cycle)) || null, v(r, C.install), owner);
      added++;
    }
  })();
  revalidatePath('/equipment');
  redirect(`/equipment?imported=${added}-${skipped}`);
}
