import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { addDays, listTbmDepts } from '@/lib/tbm';
import CaseForm from '@/components/CaseForm';
import { shareFromToday, updateCase } from '../actions';

export default async function CaseDetail({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const c = getDb().prepare('SELECT * FROM accident_cases WHERE id = ?').get(Number(id));
  if (!c) notFound();
  const used = getDb()
    .prepare("SELECT dept, date FROM tbm_meetings WHERE case_text LIKE ? ORDER BY date DESC LIMIT 30")
    .all(`%${c.title.slice(0, 40)}%`);

  return (
    <main>
      <p><Link href="/cases">← 재해사례</Link></p>
      <h1>{c.title}</h1>
      <p className="sub">
        {c.category} · {c.depts} · {c.share_from ? `${c.share_from} ~ ${addDays(c.share_from, c.share_days - 1)} 공유` : '공유일 미정'} · {c.status}
      </p>
      {sp.saved && <div className="notice">저장했습니다.</div>}
      <div className="form-actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <Link className="btn primary" href={`/cases/${c.id}/cards`}>플래시카드로 보기</Link>
        {user.role === 'admin' && (
          <form action={shareFromToday}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn" type="submit">오늘부터 다시 공유</button>
          </form>
        )}
      </div>
      {user.role === 'admin' ? (
        <CaseForm action={updateCase} c={c} depts={listTbmDepts().map((d) => d.code)} submitLabel="저장" />
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>사고 개요</h2><p style={{ whiteSpace: 'pre-line' }}>{c.summary ?? '-'}</p>
          <h2>원인</h2><p style={{ whiteSpace: 'pre-line' }}>{c.cause ?? '-'}</p>
          <h2>예방대책</h2><p style={{ whiteSpace: 'pre-line' }}>{c.prevention ?? '-'}</p>
        </div>
      )}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>이 사례가 들어간 TBM ({used.length})</h2>
        <ul className="history">
          {used.map((u) => <li key={`${u.dept}${u.date}`}><Link href={`/tbm/${encodeURIComponent(u.dept)}/${u.date}`}>{u.date} {u.dept}</Link></li>)}
        </ul>
        <p className="sub">완료된 TBM에 기록된 것만 보입니다.</p>
      </div>
    </main>
  );
}
