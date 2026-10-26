import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from './db';

// 사내 로컬 서버용 간단 로그인: 이름 + 숫자 PIN. 세션은 DB에 저장한 무작위 토큰.
export const SESSION_COOKIE = 'afood_session';

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPin(pin, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

export function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  getDb().prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (
    getDb()
      .prepare('SELECT u.id, u.name, u.role, u.dept FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.active = 1')
      .get(token) ?? null
  );
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('안전보건담당자(관리자)만 할 수 있는 작업입니다.');
  return user;
}

// 관리자는 모든 부서, 관리감독자는 자기 부서만 TBM을 고칠 수 있다
export function canEditDept(user, dept) {
  return user?.role === 'admin' || user?.dept === dept;
}
