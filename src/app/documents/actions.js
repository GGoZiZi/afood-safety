'use server';

import fs from 'node:fs';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { FILE_DIR, getDb } from '@/lib/db';
import { requireAdmin, requireUser } from '@/lib/auth';
import { saveFile } from '@/lib/upload';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};
const KINDS = ['equipment', 'msds', 'regulation', 'measurement'];
const ADMIN_ONLY = { regulation: '실시규정', measurement: '작업환경측정 결과표' };

// 설비·MSDS·실시규정·작업환경측정 공용 첨부. back: 저장 후 새로 고칠 화면 주소
export async function uploadDocument(formData) {
  const user = await requireUser();
  const kind = String(formData.get('owner_kind'));
  if (!KINDS.includes(kind)) throw new Error('잘못된 문서 종류입니다.');
  if (ADMIN_ONLY[kind] && user.role !== 'admin') throw new Error(`${ADMIN_ONLY[kind]}는 관리자만 올릴 수 있습니다.`);
  const file = formData.get('file');
  const name = await saveFile(file);
  if (!name) throw new Error('파일을 골라 주세요.');
  getDb()
    .prepare(`INSERT INTO documents (owner_kind, owner_id, title, filename, original_name, version, effective_on, note, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(kind, Number(formData.get('owner_id')) || null, clean(formData.get('title')) ?? file.name.replace(/\.[^.]+$/, ''), name, file.name,
      clean(formData.get('version')), clean(formData.get('effective_on')), clean(formData.get('note')), user.name);
  revalidatePath(String(formData.get('back') || '/'));
}

export async function deleteDocument(formData) {
  await requireAdmin();
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(formData.get('id')));
  if (!doc) return;
  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  fs.rmSync(path.join(FILE_DIR, path.basename(doc.filename)), { force: true });
  revalidatePath(String(formData.get('back') || '/'));
}
