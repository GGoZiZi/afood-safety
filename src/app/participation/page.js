import Link from 'next/link';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { LANGS } from '@/lib/i18n';
import { listParticipants } from '@/lib/participation';
import { currentYear } from '@/lib/year';
import { addParticipant, importParticipation } from './actions';

const LANG_NAME = Object.fromEntries(LANGS.map(([k, v]) => [k, v.split(' ')[0]]));

export default async function ParticipationPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const year = await currentYear();
  const rows = listParticipants(year);
  const names = getDb().prepare('SELECT DISTINCT name FROM tbm_members WHERE active = 1 ORDER BY name').all().map((r) => r.name);
  const imported = sp.imported?.split('-');
  const total = rows.reduce((a, r) => ({ items: a.items + r.items, scored: a.scored + r.scored, differ: a.differ + r.differ, reflected: a.reflected + r.reflected }), { items: 0, scored: 0, differ: 0, reflected: 0 });

  return (
    <main>
      <h1>근로자 위험성평가 참여</h1>
      <p className="sub">근로자마다 담당 공정의 위험요인 평가지를 출력해 직접 점수를 매기게 하고, 받은 점수·의견을 입력해 평가 점수와 다른 항목을 반영합니다. 외국인 근로자는 번역 평가지가 나갑니다.</p>
      {imported && <div className="notice">가져왔습니다: 근로자 {imported[0]}명, 담당 공정 {imported[1]}개, 번역 {imported[2]}건, 점수 {imported[3]}건</div>}

      <div className="stat-row">
        <div className="stat"><b>{rows.length}</b><span>참여 근로자</span></div>
        <div className="stat"><b>{total.items}</b><span>평가 대상 (중복 포함)</span></div>
        <div className="stat"><b>{total.scored}</b><span>점수·의견 입력</span></div>
        <div className={`stat ${total.differ ? 'warn' : ''}`}><b>{total.differ}</b><span>평가와 다름 (검토)</span></div>
        <div className="stat"><b>{total.reflected}</b><span>반영함</span></div>
      </div>

      <div className="filters">
        <Link className="btn primary" href={`/print/participation?year=${year}`} target="_blank">전체 평가지 출력</Link>
        <form action={addParticipant} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="hidden" name="year" value={year} />
          <input type="text" name="name" list="member-names" placeholder="근로자 이름" aria-label="근로자 이름" required />
          <datalist id="member-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
          <select name="lang" aria-label="언어" defaultValue="ko">{LANGS.map(([k]) => <option key={k} value={k}>{LANG_NAME[k]}</option>)}</select>
          <button className="btn" type="submit">근로자 추가</button>
        </form>
      </div>

      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 820 }}>
          <thead><tr><th>이름</th><th>부서</th><th>언어</th><th className="num">담당 공정</th><th className="num">평가 항목</th><th className="num">입력</th><th className="num">다름</th><th className="num">반영</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/participation/${r.id}`}><b>{r.name}</b></Link></td>
                <td>{r.dept}</td>
                <td>{LANG_NAME[r.lang]}</td>
                <td className="num">{r.procs}</td>
                <td className="num">{r.items}</td>
                <td className="num">{r.scored || ''}</td>
                <td className="num">{r.differ ? <span className="chip edit">{r.differ}</span> : ''}</td>
                <td className="num">{r.reflected || ''}</td>
                <td className="nowrap">
                  <Link className="btn small" href={`/participation/${r.id}`}>점수 입력</Link>{' '}
                  <Link className="btn small" href={`/print/participation?id=${r.id}`} target="_blank">평가지</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9}>아직 참여 근로자가 없습니다. 아래에서 기존 엑셀을 가져오거나 근로자를 추가하세요.</td></tr>}
          </tbody>
        </table>
      </div>

      {user.role === 'admin' && (
        <form action={importParticipation} className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>기존 엑셀 가져오기</h2>
          <p className="sub">"근로자 위험성평가 참여" 엑셀을 고르면 근로자별 시트에서 이름·언어·담당 공정과 외국어 번역을 가져옵니다. 다시 가져와도 입력한 의견은 지워지지 않습니다.</p>
          <input type="hidden" name="year" value={year} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="file" name="file" accept=".xlsx,.xls" required aria-label="엑셀 파일" />
            <button className="btn" type="submit">가져오기</button>
          </div>
        </form>
      )}
    </main>
  );
}
