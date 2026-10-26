import fs from 'node:fs';
import path from 'node:path';
import { PHOTO_DIR } from '@/lib/db';
import { currentUser } from '@/lib/auth';

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

export async function GET(_req, { params }) {
  if (!(await currentUser())) return new Response('로그인이 필요합니다.', { status: 401 });
  const { name } = await params;
  const file = path.basename(decodeURIComponent(name)); // 폴더 밖 파일 접근 차단
  const type = TYPES[path.extname(file).toLowerCase()];
  const full = path.join(PHOTO_DIR, file);
  if (!type || !fs.existsSync(full)) return new Response('사진 파일 없음', { status: 404 });
  return new Response(fs.readFileSync(full), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' } });
}
