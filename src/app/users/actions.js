'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { hashPin, requireAdmin, requireUser, checkPin } from '@/lib/auth';

function validPin(pin) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN은 숫자 4~8자리로 정해 주세요.');
}

export async function addUser(formData) {
  await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  const role = formData.get('role') === 'admin' ? 'admin' : 'supervisor';
  const dept = String(formData.get('dept') || '') || null;
  const pin = String(formData.get('pin') || '');
  if (!name) throw new Error('이름을 입력해 주세요.');
  validPin(pin);
  getDb().prepare('INSERT INTO users (name, role, dept, pin_hash) VALUES (?, ?, ?, ?)').run(name, role, dept, hashPin(pin));
  revalidatePath('/users');
}

export async function updateUser(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const role = formData.get('role') === 'admin' ? 'admin' : 'supervisor';
  const dept = String(formData.get('dept') || '') || null;
  const active = formData.get('active') === '1' ? 1 : 0;
  const pin = String(formData.get('pin') || '');
  const db = getDb();
  db.prepare('UPDATE users SET role = ?, dept = ?, active = ? WHERE id = ?').run(role, dept, active, id);
  if (pin) {
    validPin(pin);
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  revalidatePath('/users');
}

export async function changeMyPin(prev, formData) {
  const me = await requireUser();
  const row = getDb().prepare('SELECT pin_hash FROM users WHERE id = ?').get(me.id);
  if (!checkPin(String(formData.get('old') || ''), row.pin_hash)) return { error: '지금 PIN이 맞지 않습니다.' };
  const pin = String(formData.get('pin') || '');
  if (!/^\d{4,8}$/.test(pin)) return { error: '새 PIN은 숫자 4~8자리로 정해 주세요.' };
  getDb().prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), me.id);
  return { ok: 'PIN을 바꿨습니다.' };
}
