import Link from 'next/link';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import MsdsForm from '@/components/MsdsForm';
import { createMsds, importMsds } from './actions';

export default async function MsdsPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const all = getDb()
    .prepare(`SELECT m.*, (SELECT COUNT(*) FROM documents d WHERE d.owner_kind = 'msds' AND d.owner_id = m.id) AS docs
      FROM msds m WHERE m.active = 1 ORDER BY m.no IS NULL, m.no, m.name`)
    .all();
  let rows = all;
  if (sp.q) rows = rows.filter((m) => [m.name, m.supplier, m.components, m.place].some((v) => v?.toLowerCase().includes(sp.q.toLowerCase())));
  if (sp.place) rows = rows.filter((m) => m.place?.includes(sp.place));
  if (sp.f === 'nofile') rows = rows.filter((m) => !m.docs);
  if (sp.f === 'measure') rows = rows.filter((m) => m.measure_note?.includes('해당'));
  if (sp.f === 'unposted') rows = rows.filter((m) => !m.posted);
  const places = [...new Set(all.flatMap((m) => (m.place ?? '').split(/[\/,]/).map((s) => s.trim())).filter(Boolean))];
  const imported = sp.imported?.split('-');
  const nofile = all.filter((m) => !m.docs).length;

  return (
    <main>
      <h1>MSDS</h1>
      <p className="sub">사용 화학물질 목록과 MSDS 원본 파일을 관리합니다. 물질을 누르면 원본 PDF를 올리고 볼 수 있습니다.</p>
      {imported && <div className="notice">MSDS {imported[0]}건을 새로 넣고 {imported[1]}건을 고쳤습니다.</div>}

      <div className="stat-row">
        <Link className={`stat ${!sp.f ? 'on' : ''}`} href="/msds"><b>{all.length}</b><span>전체 물질</span></Link>
        <Link className={`stat ${sp.f === 'nofile' ? 'on' : ''} ${nofile ? 'warn' : ''}`} href="/msds?f=nofile"><b>{nofile}</b><span>원본 없음</span></Link>
        <Link className={`stat ${sp.f === 'measure' ? 'on' : ''}`} href="/msds?f=measure"><b>{all.filter((m) => m.measure_note?.includes('해당')).length}</b><span>작업환경측정 해당</span></Link>
        <Link className={`stat ${sp.f === 'unposted' ? 'on' : ''}`} href="/msds?f=unposted"><b>{all.filter((m) => !m.posted).length}</b><span>현장 미게시</span></Link>
      </div>

      <form className="filters" method="get">
        {sp.f && <input type="hidden" name="f" value={sp.f} />}
        <label>검색<input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="물질명, 성분, 공급사" /></label>
        <label>사용공정<select name="place" defaultValue={sp.place ?? ''}><option value="">전체</option>{places.map((p) => <option key={p}>{p}</option>)}</select></label>
        <button className="btn" type="submit">찾기</button>
        <div className="actions"><a className="btn primary" href="#new">+ 물질 추가</a></div>
      </form>

      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 980 }}>
          <thead><tr><th className="num">No</th><th>화학물질명</th><th>사용목적</th><th>공급사</th><th>구분</th><th className="hazard">구성성분</th><th>사용공정</th><th>월 사용량</th><th>측정</th><th>원본</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="num">{m.no}</td>
                <td><Link href={`/msds/${m.id}`}><b>{m.name}</b></Link></td>
                <td>{m.purpose}</td><td>{m.supplier}</td><td>{m.mixture}</td>
                <td className="hazard" style={{ whiteSpace: 'pre-line', fontSize: 12 }}>{m.components}</td>
                <td>{m.place}</td><td>{m.monthly_use}</td>
                <td>{m.measure_note?.includes('해당') ? <span className="chip edit">해당</span> : ''}</td>
                <td>{m.docs ? <span className="chip ok">{m.docs}</span> : <span className="chip old">없음</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10}>물질이 없습니다. 아래에서 추가하거나 MSDS Master 엑셀을 가져오세요.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 id="new">물질 추가</h2>
      <MsdsForm action={createMsds} submitLabel="추가" />

      {user.role === 'admin' && (
        <form action={importMsds} className="card">
          <h2 style={{ marginTop: 0 }}>MSDS Master 엑셀 가져오기</h2>
          <p className="sub">"화학물질명" 머리글이 있는 시트를 읽습니다. No가 있는 줄이 물질이고, 아래 줄들은 그 물질의 구성성분으로 들어갑니다. 같은 이름은 내용을 고칩니다.</p>
          <div className="filters" style={{ border: 0, padding: 0 }}>
            <input type="file" name="file" accept=".xlsx,.xls" required aria-label="엑셀 파일" />
            <button className="btn" type="submit">가져오기</button>
          </div>
        </form>
      )}
    </main>
  );
}
