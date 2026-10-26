import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '@/lib/db';

// 사진은 DB가 아니라 폴더에 둔다. 기본: data/photos (AFOOD_PHOTO_DIR 로 바꿀 수 있음)
const PHOTO_DIR = process.env.AFOOD_PHOTO_DIR || path.join(DATA_DIR, 'photos');
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

export async function GET(_req, { params }) {
  const { name } = await params;
  const file = path.basename(decodeURIComponent(name)); // 폴더 밖 파일 접근 차단
  const type = TYPES[path.extname(file).toLowerCase()];
  const full = path.join(PHOTO_DIR, file);
  if (!type || !fs.existsSync(full)) return new Response('사진 파일 없음', { status: 404 });
  return new Response(fs.readFileSync(full), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' } });
}
