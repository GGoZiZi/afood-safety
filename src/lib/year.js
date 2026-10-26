import { cookies } from 'next/headers';
import { getDb, getSetting } from './db';

// 화면 상단에서 고른 평가연도. 없으면 설정의 현재연도, 그것도 없으면 가장 최근 연도
export async function currentYear() {
  const jar = await cookies();
  const fromCookie = Number(jar.get('year')?.value);
  const years = getDb().prepare('SELECT year FROM years ORDER BY year DESC').all().map((r) => r.year);
  if (fromCookie && years.includes(fromCookie)) return fromCookie;
  const setting = Number(getSetting('current_year', ''));
  if (setting && years.includes(setting)) return setting;
  return years[0] ?? new Date().getFullYear();
}

export function isClosed(year) {
  const row = getDb().prepare('SELECT closed FROM years WHERE year = ?').get(year);
  return !!row?.closed;
}
