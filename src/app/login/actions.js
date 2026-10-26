'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { SESSION_COOKIE, checkPin, createSession, hashPin } from '@/lib/auth';

async function startSession(userId) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSession(userId), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
}

export async function login(prev, formData) {
  const name = String(formData.get('name') || '');
  const pin = String(formData.get('pin') || '');
  const user = getDb().prepare('SELECT * FROM users WHERE name = ? AND active = 1').get(name);
  if (!user || !checkPin(pin, user.pin_hash)) return { error: '이름 또는 PIN이 맞지 않습니다.' };
  await startSession(user.id);
  redirect(user.role === 'admin' ? '/risk' : '/tbm');
}

// 관리자가 아직 없을 때만: 첫 관리자(안전보건담당자) 만들기
export async function createFirstAdmin(prev, formData) {
  const db = getDb();
  if (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n > 0) return { error: '이미 관리자가 있습니다.' };
  const name = String(formData.get('name') || '').trim();
  const pin = String(formData.get('pin') || '');
  if (!name || !/^\d{4,8}$/.test(pin)) return { error: '이름과 숫자 4~8자리 PIN을 입력해 주세요.' };
  const info = db
    .prepare(`INSERT INTO users (name, role, pin_hash) VALUES (?, 'admin', ?)
      ON CONFLICT (name) DO UPDATE SET role = 'admin', pin_hash = excluded.pin_hash, active = 1 RETURNING id`)
    .get(name, hashPin(pin));
  await startSession(info.id);
  redirect('/users');
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  jar.delete(SESSION_COOKIE);
  redirect('/login');
}
