import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FILE_DIR, PHOTO_DIR } from './db';

const IMAGE = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const DOC = { 'application/pdf': '.pdf', ...IMAGE };
const DOC_EXT = /\.(pdf|jpe?g|png|webp|gif|xlsx?|docx?|hwp|hwpx)$/i;
const MAX = 20 * 1024 * 1024;

const isFile = (f) => f && typeof f !== 'string' && f.size;

function stamp() {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString();
  return `${d.slice(0, 10).replace(/-/g, '')}_${d.slice(11, 19).replace(/:/g, '')}_${crypto.randomBytes(3).toString('hex')}`;
}

async function write(dir, name, file) {
  if (file.size > MAX) throw new Error(`파일이 너무 큽니다 (20MB 이하): ${file.name}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

// 올린 사진을 data/photos에 "날짜_시각_임의값.jpg"로 저장하고 파일명을 돌려준다. 파일이 없으면 null
export async function savePhoto(file) {
  if (!isFile(file)) return null;
  const ext = IMAGE[file.type] ?? (/\.(jpe?g|png|webp|gif)$/i.exec(file.name ?? '')?.[0].toLowerCase().replace('.jpeg', '.jpg'));
  if (!ext) throw new Error(`사진 파일만 올릴 수 있습니다 (${file.name})`);
  return write(PHOTO_DIR, stamp() + ext, file);
}

// PDF·사진·오피스 문서를 data/files에 저장 (원래 확장자 유지)
export async function saveFile(file) {
  if (!isFile(file)) return null;
  const ext = DOC_EXT.exec(file.name ?? '')?.[0].toLowerCase() ?? DOC[file.type];
  if (!ext) throw new Error(`올릴 수 없는 파일 형식입니다 (${file.name}). PDF, 사진, 엑셀, 한글, 워드만 됩니다.`);
  return write(FILE_DIR, stamp() + ext, file);
}

export function photoUrl(name) {
  return `/api/photo/${encodeURIComponent(name)}`;
}

export function fileUrl(name) {
  return `/api/file/${encodeURIComponent(name)}`;
}
