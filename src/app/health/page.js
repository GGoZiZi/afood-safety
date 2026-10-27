import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { SOON_DAYS, STATUS, STATUS_CHIP, agentList, listPeople } from '@/lib/health';
import HealthForm from '@/components/HealthForm';
import HealthTabs from '@/components/HealthTabs';
import { importRoster, savePerson } from './actions';

function Due({ d }) {
  if (!d) return <span style={{ color: 'var(--ink-soft)' }}>대상 아님</span>;
  return (
    <span className="nowrap">
      {d.status === '정상' ? d.due : <span className={`chip ${STATUS_CHIP[d.status]}`}>{d.status === '첫 검진 필요' ? '기록 없음' : `${d.status} ${d.due}`}</span>}
    </span>
  );
}

export default async function HealthPage({ searchParams }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/health/ppe');
  const sp = await searchParams;
  const all = listPeople();
  const counts = Object.fromEntries(STATUS.map((s) => [s, all.filter((p) => p.status === s).length]));
  const follow = all.filter((p) => p.followups.length).length;
  let rows = all;
  if (sp.status) rows = rows.filter((p) => p.status === sp.status);
  if (sp.follow) rows = rows.filter((p) => p.followups.length);
  if (sp.special) rows = rows.filter((p) => p.agents || p.night_work);
  if (sp.dept) rows = rows.filter((p) => p.dept === sp.dept);
  if (sp.q) rows = rows.filter((p) => p.name.includes(sp.q) || p.agents?.includes(sp.q));
  rows = [...rows].sort((a, b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status) || (a.dept ?? '').localeCompare(b.dept ?? ''));
  const depts = [...new Set(all.map((p) => p.dept).filter(Boolean))];
  const imp = sp.imported?.split('-');
  const link = (patch) => `/health?${new URLSearchParams(patch)}`;
  const due = (p, k) => p.dues.find((d) => d.kind === k);

  return (
    <main>
      <h1>보건관리</h1>
      <HealthTabs admin />
      <p className="sub">사람마다 일반·특수건강진단과 보건증의 마지막 검진일에서 다음 검진일을 계산합니다. {SOON_DAYS}일 안이면 "예정", 지났으면 "지연"입니다. 판정이 C·D·R이면 사후관리를 끝낼 때까지 표시됩니다.</p>
      {imp && <div className="notice">명단을 가져왔습니다: 새로 {imp[0]}명, 고침 {imp[1]}명{Number(imp[2]) ? `, 검진 기록 ${imp[2]}건` : ''}.</div>}

      <div className="stat-row">
        <Link className={`stat ${!sp.status && !sp.follow ? 'on' : ''}`} href="/health"><b>{all.length}</b><span>대상자</span></Link>
        {STATUS.map((s) => (
          <Link key={s} className={`stat ${sp.status === s ? 'on' : ''} ${s === '지연' && counts[s] ? 'warn' : ''}`} href={link({ status: s })}>
            <b>{counts[s]}</b><span>{s}</span>
          </Link>
        ))}
        <Link className={`stat ${sp.follow ? 'on' : ''} ${follow ? 'warn' : ''}`} href={link({ follow: '1' })}><b>{follow}</b><span>사후관리 필요</span></Link>
      </div>

      <form className="filters" method="get">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <label>검색<input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="이름, 유해인자" /></label>
        <label>부서<select name="dept" defaultValue={sp.dept ?? ''}><option value="">전체</option>{depts.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label className="checks" style={{ alignSelf: 'end' }}><span><input type="checkbox" name="special" value="1" defaultChecked={!!sp.special} /> 특수건강진단 대상만</span></label>
        <button className="btn" type="submit">찾기</button>
        <div className="actions">
          <a className="btn" href={`/print/health?${new URLSearchParams({ ...(sp.dept && { dept: sp.dept }) })}`} target="_blank">명단 인쇄</a>
          <a className="btn primary" href="#new">+ 대상자 추가</a>
        </div>
      </form>

      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 980 }}>
          <thead><tr><th>상태</th><th>부서</th><th>성명</th><th>성별</th><th>일반</th><th>특수 유해인자</th><th>특수</th><th>보건증</th><th>사후관리</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><span className={`chip ${STATUS_CHIP[p.status]}`}>{p.status}</span></td>
                <td>{p.dept}</td>
                <td><Link href={`/health/${p.id}`}><b>{p.name}</b></Link></td>
                <td>{p.sex}</td>
                <td><Due d={due(p, '일반')} /></td>
                <td>{[...agentList(p), p.night_work ? '야간작업' : null].filter(Boolean).join(', ')}</td>
                <td><Due d={due(p, '특수')} /></td>
                <td><Due d={due(p, '보건증')} /></td>
                <td>{p.followups.map((e) => <span key={e.id} className="chip hidden" style={{ marginRight: 4 }}>{e.kind} {e.result}</span>)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9}>대상자가 없습니다. 아래에서 추가하거나 기존 "건강진단 설계" 명단 엑셀을 가져오세요.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 id="new">대상자 추가</h2>
      <HealthForm action={savePerson} submitLabel="추가" />

      <form action={importRoster} className="card">
        <h2 style={{ marginTop: 0 }}>기존 명단 엑셀 가져오기</h2>
        <p className="sub">"일반/특수/보건증 건강진단 설계" 명단의 부서·성명·생년월일·성별·야간근로·입사일·일반·특수·보건증 칸을 읽습니다. 주민번호 뒷자리는 저장하지 않습니다. 같은 이름·생년월일은 고칩니다. 그 명단대로 검진을 받았다면 검진일을 넣으세요. O 표시대로 검진 기록이 만들어집니다.</p>
        <div className="filters" style={{ border: 0, padding: 0 }}>
          <label>엑셀<input type="file" name="file" accept=".xlsx,.xls" required /></label>
          <label>검진일 (선택)<input type="date" name="exam_date" /></label>
          <label>검진기관 (선택)<input type="text" name="agency" /></label>
          <button className="btn" type="submit">가져오기</button>
        </div>
      </form>
    </main>
  );
}
