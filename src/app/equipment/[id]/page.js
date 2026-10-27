import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EQ_CHIP, INSPECT_KINDS, RESULTS, getEquipment, listDocuments } from '@/lib/equipment';
import { listProcesses } from '@/lib/risk';
import { today } from '@/lib/tbm';
import { photoUrl } from '@/lib/upload';
import { currentYear } from '@/lib/year';
import DocList from '@/components/DocList';
import EquipmentForm from '@/components/EquipmentForm';
import { addInspection, deleteInspection, setEquipmentActive, updateEquipment } from '../actions';

export default async function EquipmentDetail({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const e = getEquipment(Number(id));
  if (!e) notFound();
  const logs = getDb().prepare('SELECT * FROM equipment_inspections WHERE equipment_id = ? ORDER BY date DESC, id DESC').all(e.id);
  const back = `/equipment/${e.id}`;

  return (
    <main>
      <p><Link href="/equipment">← 설비 목록</Link></p>
      <h1>{e.name}{e.model ? ` · ${e.model}` : ''}</h1>
      <p className="sub">
        <span className={`chip ${EQ_CHIP[e.status]}`}>{e.status}</span>{' '}
        {e.location ?? ''} · {e.cert_type} · 점검주기 {e.cycle_months ? `${e.cycle_months}개월` : '미설정'} · 마지막 점검 {e.last_date ?? '없음'} · 다음 점검 {e.next_due ?? '-'}
        {!e.active && ' · 목록에서 뺀 설비'}
      </p>
      {sp.saved && <div className="notice">저장했습니다.</div>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>점검 기록 추가</h2>
        <form action={addInspection}>
          <input type="hidden" name="id" value={e.id} />
          <div className="form-grid">
            <label><span>점검일</span><input type="date" name="date" required defaultValue={today()} /></label>
            <label><span>구분</span><select name="kind" defaultValue="정기점검">{INSPECT_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label><span>결과</span><select name="result" defaultValue="양호">{RESULTS.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label><span>점검자</span><input type="text" name="inspector" defaultValue={user.name} /></label>
            <label className="span2"><span>내용</span><input type="text" name="note" placeholder="점검 항목, 조치 내용 등" /></label>
            <label className="span2"><span>사진</span><input type="file" name="photo" accept="image/*" capture="environment" /></label>
          </div>
          <div className="form-actions"><button className="btn primary" type="submit">기록</button></div>
        </form>
        <p className="sub" style={{ marginTop: 8 }}>"수리" 기록은 다음 점검일 계산에 들어가지 않습니다.</p>
        <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="sheet" style={{ minWidth: 640 }}>
          <thead><tr><th>점검일</th><th>구분</th><th>결과</th><th>점검자</th><th>내용</th><th>사진</th><th></th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="nowrap">{l.date}</td><td>{l.kind}</td>
                <td>{l.result === '양호' ? l.result : <span className="chip hidden">{l.result}</span>}</td>
                <td>{l.inspector}</td><td>{l.note}</td>
                <td>{l.photo && <a href={photoUrl(l.photo)} target="_blank">보기</a>}</td>
                <td>
                  <form action={deleteInspection}><input type="hidden" name="id" value={l.id} /><button className="btn small danger" type="submit">지우기</button></form>
                </td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={7}>점검 기록이 없습니다.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>인증서 · 신고증명서 · 검사성적서</h2>
        <DocList kind="equipment" ownerId={e.id} docs={listDocuments('equipment', e.id)} back={back} canDelete={user.role === 'admin'} titleHint="예: 자율안전확인 신고증명서" />
      </div>

      {e.photo && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>설비 사진</h2>
          <a href={photoUrl(e.photo)} target="_blank"><img src={photoUrl(e.photo)} alt={e.name} style={{ maxWidth: 320, width: '100%', borderRadius: 8 }} /></a>
        </div>
      )}

      <h2>설비 정보</h2>
      <EquipmentForm action={updateEquipment} e={e} processes={listProcesses(await currentYear())} submitLabel="저장" />
      {user.role === 'admin' && (
        <form action={setEquipmentActive}>
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="active" value={e.active ? '0' : '1'} />
          <button className={`btn ${e.active ? 'danger' : ''}`} type="submit">{e.active ? '목록에서 빼기 (폐기·이전, 기록은 남음)' : '목록에 다시 넣기'}</button>
        </form>
      )}
    </main>
  );
}
