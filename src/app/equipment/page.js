import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { CERT_TYPES, EQ_CHIP, EQ_STATUS, SOON_DAYS, listEquipment } from '@/lib/equipment';
import { listProcesses } from '@/lib/risk';
import { currentYear } from '@/lib/year';
import EquipmentForm from '@/components/EquipmentForm';
import { createEquipment, importEquipment } from './actions';

export default async function EquipmentPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const all = listEquipment();
  const counts = Object.fromEntries(EQ_STATUS.map((s) => [s, all.filter((e) => e.status === s).length]));
  let rows = all;
  if (sp.status) rows = rows.filter((e) => e.status === sp.status);
  else if (sp.todo) rows = rows.filter((e) => e.status !== '정상');
  if (sp.cert) rows = rows.filter((e) => e.cert_type === sp.cert);
  if (sp.loc) rows = rows.filter((e) => e.location === sp.loc);
  if (sp.q) rows = rows.filter((e) => [e.name, e.model, e.maker].some((v) => v?.includes(sp.q)));
  // 급한 순서: 지연 → 예정 → 첫 점검 → 미설정 → 정상, 같은 상태는 다음 점검일 순
  rows = [...rows].sort((a, b) => EQ_STATUS.indexOf(a.status) - EQ_STATUS.indexOf(b.status) || (a.next_due ?? '9').localeCompare(b.next_due ?? '9'));
  const locs = [...new Set(all.map((e) => e.location).filter(Boolean))];
  const imported = sp.imported?.split('-');
  const link = (patch) => `/equipment?${new URLSearchParams(patch)}`;

  return (
    <main>
      <h1>설비 · 안전인증</h1>
      <p className="sub">설비마다 점검주기를 정하면 마지막 점검일(없으면 설치일)부터 다음 점검일을 계산합니다. {SOON_DAYS}일 안에 돌아오는 점검은 "예정", 지난 점검은 "지연"으로 보입니다.</p>
      {imported && <div className="notice">설비 {imported[0]}대를 가져왔습니다{Number(imported[1]) ? ` (이미 있는 ${imported[1]}대는 건너뜀)` : ''}. 설비마다 점검주기와 설치일을 넣어 주세요.</div>}

      <div className="stat-row">
        <Link className={`stat ${!sp.status && !sp.todo ? 'on' : ''}`} href="/equipment"><b>{all.length}</b><span>전체 설비</span></Link>
        <Link className={`stat ${sp.todo ? 'on' : ''}`} href={link({ todo: '1' })}><b>{all.length - counts.정상}</b><span>챙길 것</span></Link>
        {EQ_STATUS.map((s) => (
          <Link key={s} className={`stat ${sp.status === s ? 'on' : ''} ${s === '지연' && counts[s] ? 'warn' : ''}`} href={link({ status: s })}>
            <b>{counts[s]}</b><span>{s}</span>
          </Link>
        ))}
      </div>

      <form className="filters" method="get">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <label>검색<input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="설비명, 모델, 업체" /></label>
        <label>장소<select name="loc" defaultValue={sp.loc ?? ''}><option value="">전체</option>{locs.map((l) => <option key={l}>{l}</option>)}</select></label>
        <label>인증<select name="cert" defaultValue={sp.cert ?? ''}><option value="">전체</option>{CERT_TYPES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <button className="btn" type="submit">찾기</button>
        <div className="actions"><a className="btn primary" href="#new">+ 설비 추가</a></div>
      </form>

      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 980 }}>
          <thead><tr><th>상태</th><th>장소</th><th>설비명</th><th>모델</th><th>인증</th><th className="num">주기</th><th>마지막 점검</th><th>다음 점검</th><th>담당</th><th className="num">문서</th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td><span className={`chip ${EQ_CHIP[e.status]}`}>{e.status}</span></td>
                <td>{e.location}</td>
                <td><Link href={`/equipment/${e.id}`}><b>{e.name}</b></Link></td>
                <td>{e.model}</td>
                <td>{e.cert_type === '해당없음' ? '' : e.cert_type}</td>
                <td className="num">{e.cycle_months ? `${e.cycle_months}개월` : ''}</td>
                <td className="nowrap">{e.last_date ?? ''}{e.last_result && e.last_result !== '양호' ? ` (${e.last_result})` : ''}</td>
                <td className="nowrap">{e.next_due ?? ''}</td>
                <td>{e.owner}</td>
                <td className="num">{e.docs || ''}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10}>설비가 없습니다. 아래에서 추가하거나 기존 "자율안전인증리스트" 엑셀을 가져오세요.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 id="new">설비 추가</h2>
      <EquipmentForm action={createEquipment} e={{ owner: user.role === 'admin' ? '' : user.name }} processes={listProcesses(await currentYear())} submitLabel="추가" />

      {user.role === 'admin' && (
        <form action={importEquipment} className="card">
          <h2 style={{ marginTop: 0 }}>기존 엑셀 가져오기</h2>
          <p className="sub">"자율안전인증리스트" 엑셀의 장소·업체·설비명·모델명·자율안전인증마크 칸을 읽습니다. 마크가 "o"인 설비는 자율안전확인으로 들어갑니다. 엑셀 안의 사진은 옮겨지지 않으니 설비 화면에서 올려 주세요.</p>
          <div className="filters" style={{ border: 0, padding: 0 }}>
            <label>엑셀<input type="file" name="file" accept=".xlsx,.xls" required /></label>
            <label>담당자 (전체 설비)<input type="text" name="owner" defaultValue="신용택" /></label>
            <button className="btn" type="submit">가져오기</button>
          </div>
        </form>
      )}
    </main>
  );
}
