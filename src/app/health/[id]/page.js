import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EXAM_KINDS, NEEDS_FOLLOWUP, RESULTS, RESULT_LABEL, STATUS_CHIP, dueList, worst } from '@/lib/health';
import { today } from '@/lib/tbm';
import HealthForm from '@/components/HealthForm';
import HealthTabs from '@/components/HealthTabs';
import { addExam, deleteExam, savePerson, setPersonActive, updateExam } from '../actions';

const ResultSelect = ({ value }) => (
  <select name="result" defaultValue={value ?? ''}>
    <option value="">-</option>
    {RESULTS.map((r) => <option key={r} value={r}>{r} {RESULT_LABEL[r]}</option>)}
  </select>
);

export default async function HealthPerson({ params, searchParams }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/health/ppe');
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const p = db.prepare('SELECT * FROM health_people WHERE id = ?').get(Number(id));
  if (!p) notFound();
  const exams = db.prepare('SELECT * FROM health_exams WHERE person_id = ? ORDER BY date DESC, id DESC').all(p.id);
  const dues = dueList(p, exams);
  const status = worst(dues);

  return (
    <main>
      <h1>보건관리</h1>
      <HealthTabs admin />
      <p><Link href="/health">← 대상자 목록</Link></p>
      <h2 style={{ marginTop: 0 }}>{p.name}{p.dept ? ` · ${p.dept}` : ''}</h2>
      <p className="sub">
        <span className={`chip ${STATUS_CHIP[status]}`}>{status}</span>{' '}
        {[p.sex, p.birth && `${p.birth} 생`, p.hire_date && `${p.hire_date} 입사`].filter(Boolean).join(' · ')}
        {!p.active && ' · 명단에서 뺀 사람'}
      </p>
      {sp.saved && <div className="notice">저장했습니다.</div>}

      <div className="stat-row">
        {dues.map((d) => (
          <div key={d.kind} className={`stat ${d.status === '지연' ? 'warn' : ''}`}>
            <b style={{ fontSize: 17 }}>{d.due ?? '기록 없음'}</b>
            <span>{d.kind} 다음 검진 ({d.cycle}개월) · 마지막 {d.last ?? '-'}</span>
          </div>
        ))}
        {dues.length === 0 && <div className="stat"><b>-</b><span>챙길 검진이 없습니다</span></div>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>검진 기록 추가</h2>
        <form action={addExam}>
          <input type="hidden" name="person_id" value={p.id} />
          <div className="form-grid">
            <label><span>검진일</span><input type="date" name="date" required defaultValue={today()} /></label>
            <label><span>종류</span><select name="kind" defaultValue="일반">{EXAM_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label><span>판정</span><ResultSelect /></label>
            <label><span>검진기관</span><input type="text" name="agency" /></label>
            <label className="span2"><span>사후관리 조치</span><input type="text" name="followup" placeholder="예: 2차 검진 예약, 작업 전환, 보호구 지급" /></label>
          </div>
          <div className="form-actions"><button className="btn primary" type="submit">기록</button></div>
        </form>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="sheet" style={{ minWidth: 760 }}>
            <thead><tr><th>검진일</th><th>종류</th><th>기관</th><th>판정 · 사후관리</th><th></th></tr></thead>
            <tbody>
              {exams.map((e) => {
                const need = NEEDS_FOLLOWUP.includes(e.result);
                return (
                  <tr key={e.id}>
                    <td className="nowrap">{e.date}</td>
                    <td>{e.kind}</td>
                    <td>{e.agency}</td>
                    <td>
                      <form action={updateExam.bind(null, need ? e.followup_done : 0)} className="checks">
                        <input type="hidden" name="id" value={e.id} />
                        <ResultSelect value={e.result} />
                        <input type="text" name="followup" defaultValue={e.followup ?? ''} placeholder="사후관리" style={{ minWidth: 160 }} />
                        <button className="btn small" type="submit">저장</button>
                        {need && !e.followup_done && <button className="btn small primary" formAction={updateExam.bind(null, 1)}>사후관리 끝</button>}
                        {need && (e.followup_done ? <span className="chip ok">사후관리 끝</span> : <span className="chip hidden">사후관리 필요</span>)}
                      </form>
                    </td>
                    <td>
                      <form action={deleteExam}><input type="hidden" name="id" value={e.id} /><button className="btn small danger" type="submit">지우기</button></form>
                    </td>
                  </tr>
                );
              })}
              {exams.length === 0 && <tr><td colSpan={5}>검진 기록이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <h2>대상자 정보</h2>
      <HealthForm action={savePerson} p={p} submitLabel="저장" />
      <form action={setPersonActive} style={{ marginTop: 8 }}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="active" value={p.active ? '0' : '1'} />
        <button className={`btn ${p.active ? 'danger' : ''}`} type="submit">{p.active ? '명단에서 빼기 (퇴사 등)' : '명단에 다시 넣기'}</button>
      </form>
    </main>
  );
}
