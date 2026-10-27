import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { listDocuments } from '@/lib/equipment';
import { listMeasurements, measureCycle, nextMeasurement } from '@/lib/health';
import { today } from '@/lib/tbm';
import DocList from '@/components/DocList';
import HealthTabs from '@/components/HealthTabs';
import { addResults, deleteMeasurement, deleteResult, saveMeasurement, setMeasureCycle } from '../actions';

const CHIP = { 지연: 'hidden', 예정: 'edit', '첫 측정 필요': 'edit', 정상: 'ok' };
const pct = (r) => (r.value != null && r.limit_value ? `${Math.round((r.value / r.limit_value) * 100)}%` : '');

export default async function MeasurePage({ searchParams }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/health/ppe');
  const sp = await searchParams;
  const ms = listMeasurements();
  const next = nextMeasurement(ms);
  const cycle = measureCycle();
  const msdsN = getDb().prepare("SELECT COUNT(*) AS n FROM msds WHERE active = 1 AND measure_note LIKE '%해당%'").get().n;
  const now = today();

  return (
    <main>
      <h1>보건관리</h1>
      <HealthTabs admin />
      <p className="sub">상반기·하반기 측정마다 결과표를 올리고 유해인자별 측정치를 적어 두면, 노출기준을 넘은 곳과 다음 측정 시기를 보여 줍니다.</p>

      <div className="stat-row">
        <div className={`stat ${next.status === '지연' ? 'warn' : ''}`}>
          <b style={{ fontSize: 17 }}>{next.due ?? '-'}</b>
          <span>다음 측정 <span className={`chip ${CHIP[next.status]}`}>{next.status}</span></span>
        </div>
        <div className="stat"><b style={{ fontSize: 17 }}>{next.last ?? '-'}</b><span>마지막 측정</span></div>
        <div className={`stat ${ms[0]?.over ? 'warn' : ''}`}><b>{ms[0]?.over ?? 0}</b><span>최근 측정 노출기준 초과</span></div>
        <Link className="stat" href="/msds?f=measure"><b>{msdsN}</b><span>MSDS 작업환경측정 해당 물질</span></Link>
      </div>

      <form action={setMeasureCycle} className="filters">
        <label>측정 주기
          <select name="cycle" defaultValue={cycle}>
            <option value={6}>6개월 (기본)</option>
            <option value={12}>12개월 (최근 2회 연속 노출기준 미만 등)</option>
          </select>
        </label>
        <button className="btn" type="submit">주기 저장</button>
      </form>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>측정 추가</h2>
        <form action={saveMeasurement}>
          <div className="form-grid">
            <label><span>측정일</span><input type="date" name="date" required defaultValue={now} /></label>
            <label><span>반기</span><select name="half" defaultValue={Number(now.slice(5, 7)) <= 6 ? '상반기' : '하반기'}><option>상반기</option><option>하반기</option></select></label>
            <label><span>측정기관</span><input type="text" name="agency" /></label>
            <label><span>비고</span><input type="text" name="note" /></label>
          </div>
          <div className="form-actions"><button className="btn primary" type="submit">추가</button></div>
        </form>
        <p className="sub" style={{ marginTop: 8 }}>같은 해·반기를 다시 추가하면 측정일과 기관만 고칩니다.</p>
      </div>

      {ms.map((m) => (
        <section key={m.id} id={`m${m.id}`} className="card">
          <h2 style={{ marginTop: 0 }}>
            {m.year}년 {m.half} · {m.date}{m.agency ? ` · ${m.agency}` : ''}{' '}
            {m.over ? <span className="chip hidden">노출기준 초과 {m.over}곳</span> : m.results.length ? <span className="chip ok">모두 기준 이내</span> : null}
          </h2>
          {m.note && <p className="sub">{m.note}</p>}
          <div className="table-wrap">
            <table className="sheet" style={{ minWidth: 640 }}>
              <thead><tr><th>부서·공정</th><th>유해인자</th><th className="num">측정치</th><th className="num">노출기준</th><th>단위</th><th className="num">기준 대비</th><th></th></tr></thead>
              <tbody>
                {m.results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.place}</td><td>{r.agent}</td>
                    <td className="num">{r.value ?? ''}</td><td className="num">{r.limit_value ?? ''}</td><td>{r.unit}</td>
                    <td className="num">{r.over ? <span className="chip hidden">{pct(r)}</span> : pct(r)}</td>
                    <td><form action={deleteResult}><input type="hidden" name="id" value={r.id} /><button className="btn small danger" type="submit">지우기</button></form></td>
                  </tr>
                ))}
                {m.results.length === 0 && <tr><td colSpan={7}>아직 측정 결과가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          <form action={addResults} style={{ marginTop: 8 }}>
            <input type="hidden" name="measurement_id" value={m.id} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--ink-soft)' }}>
              결과 추가 (한 줄에 하나: 부서·공정 | 유해인자 | 측정치 | 노출기준 | 단위. 엑셀에서 복사해 붙여도 됩니다)
              <textarea name="lines" rows={3} placeholder={'생산1팀 혼합 | 곡물분진 | 1.2 | 4 | mg/㎥\n공무 용접 | 소음 | 82 | 90 | dB(A)'} />
            </label>
            <div className="form-actions"><button className="btn" type="submit">결과 추가</button></div>
          </form>
          <h3>결과표</h3>
          <DocList kind="measurement" ownerId={m.id} docs={listDocuments('measurement', m.id)} back="/health/measure" canDelete titleHint={`${m.year}년 ${m.half} 작업환경측정 결과표`} />
          <form action={deleteMeasurement} style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={m.id} />
            <button className="btn small danger" type="submit">이 측정 지우기</button>
          </form>
        </section>
      ))}
      {ms.length === 0 && <p className="sub">아직 측정 기록이 없습니다.</p>}
    </main>
  );
}
