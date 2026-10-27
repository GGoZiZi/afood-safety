import fs from 'node:fs';
import path from 'node:path';
import { FILE_DIR, getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';

const TYPES = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.doc': 'application/msword',
  '.hwp': 'application/x-hwp', '.hwpx': 'application/x-hwp',
};

// 첨부 문서 내려받기. PDF·사진은 브라우저에서 바로 열리고, 나머지는 원래 파일명으로 저장된다
export async function GET(_req, { params }) {
  if (!(await currentUser())) return new Response('로그인이 필요합니다.', { status: 401 });
  const { name } = await params;
  const file = path.basename(decodeURIComponent(name));
  const ext = path.extname(file).toLowerCase();
  const full = path.join(FILE_DIR, file);
  if (!TYPES[ext] || !fs.existsSync(full)) return new Response('파일 없음', { status: 404 });
  const doc = getDb().prepare('SELECT original_name FROM documents WHERE filename = ?').get(file);
  const inline = ext === '.pdf' || TYPES[ext].startsWith('image/');
  const dispName = encodeURIComponent(doc?.original_name ?? file);
  return new Response(fs.readFileSync(full), {
    headers: {
      'Content-Type': TYPES[ext],
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${dispName}`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
