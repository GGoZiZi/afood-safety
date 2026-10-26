import Link from 'next/link';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { addDays, today } from '@/lib/tbm';

export default async function CasesPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = today();
  const where = [];
  const args = [];
  if (sp.status) { where.push('status = ?'); args.push(sp.status); }
  if (sp.q) { where.push("(title LIKE ? OR IFNULL(category,'') LIKE ? OR IFNULL(summary,'') LIKE ?)"); args.push(`%${sp.q}%`, `%${sp.q}%`, `%${sp.q}%`); }
  const rows = getDb()
    .prepare(`SELECT * FROM accident_cases ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY share_from IS NULL, share_from DESC, id DESC`)
    .all(...args);
  const sharing = (c) => c.status === '채택' && c.share_from && now >= c.share_from && now <= addDays(c.share_from, c.share_days - 1);

  return (
    <main>
      <h1>재해사례</h1>
      <p className="sub">채택된 사례는 공유 시작일부터 {7}일(사례별 설정) 동안 해당 부서 TBM "사고사례 공유" 칸에 자동으로 들어갑니다. 자동 수집은 4단계에서 붙입니다.</p>
      <form className="filters" method="get">
        <label>검색<input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="제목, 분류, 개요" /></label>
        <label>상태
          <select name="status" defaultValue={sp.status ?? ''}>
            <option value="">전체</option><option>채택</option><option>검토대기</option><option>제외</option>
          </select>
        </label>
        <button className="btn" type="submit">찾기</button>
        {user.role === 'admin' && <div className="actions"><Link className="btn primary" href="/cases/new">+ 사례 추가</Link></div>}
      </form>
      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 900 }}>
          <thead><tr><th>분류</th><th className="hazard">제목</th><th>공유 부서</th><th>공유 기간</th><th>상태</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="nowrap">{c.category}</td>
                <td className="hazard"><Link href={`/cases/${c.id}`}>{c.title}</Link></td>
                <td>{c.depts}</td>
                <td className="nowrap">{c.share_from ? `${c.share_from} ~ ${addDays(c.share_from, c.share_days - 1)}` : '-'}</td>
                <td>{sharing(c) ? <span className="chip ok">공유 중</span> : <span className={`chip ${c.status === '채택' ? 'old' : c.status === '제외' ? 'hidden' : 'edit'}`}>{c.status}</span>}</td>
                <td className="nowrap"><Link className="btn small" href={`/cases/${c.id}/cards`}>카드 보기</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6}>사례가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
