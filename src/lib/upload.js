import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PHOTO_DIR } from './db';

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX = 20 * 1024 * 1024;

// 올린 사진을 data/photos에 "날짜_시각_임의값.jpg"로 저장하고 파일명을 돌려준다. 사진이 아니면 null
export async function savePhoto(file) {
  if (!file || typeof file === 'string' || !file.size) return null;
  const ext = EXT[file.type] ?? (/\.(jpe?g|png|webp|gif)$/i.exec(file.name ?? '')?.[0].toLowerCase().replace('.jpeg', '.jpg'));
  if (!ext) throw new Error(`사진 파일만 올릴 수 있습니다 (${file.name})`);
  if (file.size > MAX) throw new Error(`사진이 너무 큽니다 (20MB 이하): ${file.name}`);
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString();
  const name = `${d.slice(0, 10).replace(/-/g, '')}_${d.slice(11, 19).replace(/:/g, '')}_${crypto.randomBytes(3).toString('hex')}${ext}`;
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  fs.writeFileSync(path.join(PHOTO_DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export function photoUrl(name) {
  return `/api/photo/${encodeURIComponent(name)}`;
}
