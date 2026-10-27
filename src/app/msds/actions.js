'use server';

import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireAdmin, requireUser } from '@/lib/auth';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' || s === 'None' ? null : s;
};

const FIELDS = ['name', 'msds_no', 'purpose', 'supplier', 'mixture', 'components', 'place', 'monthly_use', 'measure_note', 'revised_on'];

function read(formData) {
  const row = Object.fromEntries(FIELDS.map((k) => [k, clean(formData.get(k))]));
  if (!row.name) throw new Error('화학물질명을 입력해 주세요.');
  row.no = Number(formData.get('no')) || null;
  row.posted = formData.get('posted') === '1' ? 1 : 0;
  return row;
}

export async function createMsds(formData) {
  await requireUser();
  const r = read(formData);
  const info = getDb()
    .prepare(`INSERT INTO msds (no, posted, ${FIELDS.join(', ')}) VALUES (@no, @posted, ${FIELDS.map((k) => '@' + k).join(', ')})`)
    .run(r);
  revalidatePath('/msds');
  redirect(`/msds/${info.lastInsertRowid}?saved=1`);
}

export async function updateMsds(formData) {
  await requireUser();
  const id = Number(formData.get('id'));
  const r = read(formData);
  getDb()
    .prepare(`UPDATE msds SET no = @no, posted = @posted, ${FIELDS.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = @id`)
    .run({ ...r, id });
  revalidatePath('/msds');
  redirect(`/msds/${id}?saved=1`);
}

export async function setMsdsActive(formData) {
  await requireAdmin();
  getDb().prepare('UPDATE msds SET active = ? WHERE id = ?').run(formData.get('active') === '1' ? 1 : 0, Number(formData.get('id')));
  revalidatePath('/msds');
  redirect('/msds');
}

// MSDS Master 엑셀: "화학물질명" 머리글 아래로, No가 있는 줄이 새 물질이고 No 없는 줄은 앞 물질의 구성성분
export async function importMsds(formData) {
  await requireAdmin();
  const file = formData.get('file');
  if (!file || typeof file === 'string' || !file.size) throw new Error('엑셀 파일을 골라 주세요.');
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
  const db = getDb();
  const out = [];
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, raw: false });
    const h = rows.findIndex((r) => r.some((c) => String(c ?? '').replace(/\s/g, '').includes('화학물질명')));
    if (h < 0) continue;
    const head = rows[h].map((c) => String(c ?? '').replace(/\s/g, ''));
    const col = (re) => head.findIndex((c) => re.test(c));
    const C = { no: col(/^No/i), name: col(/화학물질명/), msds: col(/MSDS번호/i), purpose: col(/사용목적/), supplier: col(/제조사|공급사/),
      mixture: col(/순수|혼합/), comp: col(/구성성분/), cas: col(/CAS/i), pct: col(/함유량/), place: col(/사용공정|구역/), use: col(/사용량/), note: col(/측정|특이/) };
    const v = (r, i) => (i >= 0 ? clean(r[i]) : null);
    let cur = null;
    for (const r of rows.slice(h + 1)) {
      const name = v(r, C.name);
      if (v(r, C.no) && name) {
        cur = { no: Number(v(r, C.no)) || null, name: name.replace(/\s+/g, ' '), msds_no: v(r, C.msds), purpose: v(r, C.purpose), supplier: v(r, C.supplier),
          mixture: v(r, C.mixture), place: v(r, C.place), monthly_use: v(r, C.use), measure_note: v(r, C.note), comps: [] };
        out.push(cur);
      }
      if (cur && (v(r, C.comp) || v(r, C.cas))) cur.comps.push([v(r, C.comp), v(r, C.cas), v(r, C.pct)].map((x) => x ?? '-').join(' | '));
      if (cur && !cur.measure_note && v(r, C.note)) cur.measure_note = v(r, C.note);
    }
  }
  if (out.length === 0) throw new Error('"화학물질명" 머리글이 있는 시트를 찾지 못했습니다.');
  const find = db.prepare('SELECT id FROM msds WHERE name = ? AND active = 1');
  const ins = db.prepare(`INSERT INTO msds (no, name, msds_no, purpose, supplier, mixture, components, place, monthly_use, measure_note)
    VALUES (@no, @name, @msds_no, @purpose, @supplier, @mixture, @components, @place, @monthly_use, @measure_note)`);
  const up = db.prepare(`UPDATE msds SET no = @no, msds_no = @msds_no, purpose = @purpose, supplier = @supplier, mixture = @mixture,
    components = @components, place = @place, monthly_use = @monthly_use, measure_note = @measure_note, updated_at = datetime('now','localtime') WHERE id = @id`);
  let added = 0;
  let updated = 0;
  db.transaction(() => {
    for (const m of out) {
      const row = { ...m, components: m.comps.join('\n') || null };
      delete row.comps;
      const ex = find.get(m.name);
      if (ex) { up.run({ ...row, id: ex.id }); updated++; } else { ins.run(row); added++; }
    }
  })();
  revalidatePath('/msds');
  redirect(`/msds?imported=${added}-${updated}`);
}
