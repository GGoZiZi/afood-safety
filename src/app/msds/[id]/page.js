import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { listDocuments } from '@/lib/equipment';
import DocList from '@/components/DocList';
import MsdsForm from '@/components/MsdsForm';
import { setMsdsActive, updateMsds } from '../actions';

export default async function MsdsDetail({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const m = getDb().prepare('SELECT * FROM msds WHERE id = ?').get(Number(id));
  if (!m) notFound();
  const back = `/msds/${m.id}`;
  return (
    <main>
      <p><Link href="/msds">← MSDS 목록</Link></p>
      <h1>{m.name}</h1>
      <p className="sub">{[m.supplier, m.purpose, m.place, m.revised_on && `${m.revised_on} 개정`].filter(Boolean).join(' · ')}{!m.active && ' · 목록에서 뺀 물질'}</p>
      {sp.saved && <div className="notice">저장했습니다.</div>}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>MSDS 원본</h2>
        <DocList kind="msds" ownerId={m.id} docs={listDocuments('msds', m.id)} back={back} canDelete={user.role === 'admin'} titleHint="예: MSDS (2026 개정)" />
      </div>
      <MsdsForm action={updateMsds} m={m} submitLabel="저장" />
      {user.role === 'admin' && (
        <form action={setMsdsActive}>
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="active" value={m.active ? '0' : '1'} />
          <button className={`btn ${m.active ? 'danger' : ''}`} type="submit">{m.active ? '목록에서 빼기 (사용 중지)' : '목록에 다시 넣기'}</button>
        </form>
      )}
    </main>
  );
}
