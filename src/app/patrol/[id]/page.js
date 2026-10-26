import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { listCodes, listProcesses } from '@/lib/risk';
import { photoUrl } from '@/lib/upload';
import { isClosed } from '@/lib/year';
import { addFindingPhotos, deleteFinding, registerFinding, saveFinding, setFindingDecision, updatePatrol } from '../actions';

const DECISION_CHIP = { 등록: 'ok', 미등록: 'old', 미정: 'edit' };

export default async function PatrolDetail({ params }) {
  await requireUser();
  const { id } = await params;
  const db = getDb();
  const p = db.prepare('SELECT * FROM patrols WHERE id = ?').get(Number(id));
  if (!p) notFound();
  const findings = db
    .prepare(`SELECT f.*, r.item_code, r.risk FROM patrol_findings f LEFT JOIN risk_items r ON r.id = f.risk_item_id
      WHERE f.patrol_id = ? ORDER BY f.id`)
    .all(p.id);
  const procs = listProcesses(p.year);
  const causes = listCodes('cause');
  const closed = isClosed(p.year);

  return (
    <main>
      <p><Link href="/patrol">← 순회점검 목록</Link></p>
      <h1>순회점검 · {p.date} {p.area ?? ''}</h1>
      <p className="sub">사진 {findings.length}장 · 등록 {findings.filter((f) => f.decision === '등록').length} · 조치만 {findings.filter((f) => f.decision === '미등록').length} · 결정 전 {findings.filter((f) => f.decision === '미정').length}</p>

      <details className="card">
        <summary>점검 정보 고치기 · 사진 더 올리기</summary>
        <form action={updatePatrol} style={{ marginTop: 10 }}>
          <input type="hidden" name="id" value={p.id} />
          <div className="form-grid">
            <label><span>점검일</span><input type="date" name="date" defaultValue={p.date} /></label>
            <label><span>점검 구역</span><input type="text" name="area" defaultValue={p.area ?? ''} /></label>
            <label><span>점검자</span><input type="text" name="inspector" defaultValue={p.inspector ?? ''} /></label>
            <label><span>메모</span><input type="text" name="note" defaultValue={p.note ?? ''} /></label>
          </div>
          <div className="form-actions"><button className="btn small" type="submit">저장</button></div>
        </form>
        <form action={addFindingPhotos} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <input type="hidden" name="id" value={p.id} />
          <input type="file" name="photos" accept="image/*" multiple aria-label="사진 더 올리기" />
          <button className="btn small" type="submit">사진 추가 (사진 없이 누르면 빈 지적사항 추가)</button>
        </form>
      </details>

      {findings.map((f, i) => {
        const locked = f.decision === '등록';
        return (
          <div key={f.id} className="card" id={`f${f.id}`}>
            <div className="finding">
              <div className="shots">
                {f.photo
                  ? <a href={photoUrl(f.photo)} target="_blank"><img className="shot" src={photoUrl(f.photo)} alt={`${i + 1}번 현장 사진`} /></a>
                  : <div className="shot" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-soft)' }}>사진 없음</div>}
                {f.after_photo && (
                  <a href={photoUrl(f.after_photo)} target="_blank"><img className="shot" src={photoUrl(f.after_photo)} alt={`${i + 1}번 개선 후 사진`} /></a>
                )}
              </div>
              <form action={saveFinding}>
                <input type="hidden" name="id" value={f.id} />
                <div className="improve-head" style={{ marginBottom: 8 }}>
                  <b>{i + 1}.</b>
                  <span className={`chip ${DECISION_CHIP[f.decision]}`}>{f.decision === '미등록' ? '조치만 관리' : f.decision === '등록' ? '위험성평가 등록' : '결정 전'}</span>
                  {f.risk_item_id && <Link href={`/risk/${f.risk_item_id}`}>{f.item_code} {f.risk != null ? `(${f.risk}점)` : ''}</Link>}
                  {f.done_date && <span className="chip ok">조치완료 {f.done_date}</span>}
                </div>
                <fieldset disabled={locked}>
                  <div className="form-grid">
                    <label className="span2"><span>공정</span>
                      <select name="process_code" defaultValue={f.process_code ?? ''}>
                        <option value="">(고르기)</option>
                        {procs.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.dept} · {x.name}</option>)}
                      </select>
                    </label>
                    <label className="span2"><span>위치</span><input type="text" name="location" defaultValue={f.location ?? ''} /></label>
                    <label className="span4"><span>지적 내용 (유해위험요인)</span><textarea name="finding" defaultValue={f.finding ?? ''} /></label>
                    <label className="span2"><span>개선 대책</span><textarea name="measure" defaultValue={f.measure ?? ''} /></label>
                    <label><span>조치담당자</span><input type="text" name="owner" defaultValue={f.owner ?? ''} /></label>
                    <label><span>조치예정일</span><input type="date" name="due_date" defaultValue={f.due_date ?? ''} /></label>
                  </div>

                  {!locked && (
                    <>
                      <div className="form-actions" style={{ marginTop: 8 }}>
                        <button className="btn small" type="submit">기록 저장</button>
                        {f.decision === '미정'
                          ? <button className="btn small" type="submit" formAction={setFindingDecision.bind(null, '미등록')}>등록 안 함 (조치만 관리)</button>
                          : <button className="btn small" type="submit" formAction={setFindingDecision.bind(null, '미정')}>결정 전으로 되돌리기</button>}
                        <button className="btn small danger" type="submit" formAction={deleteFinding}>지우기</button>
                      </div>
                      {!closed && (
                        <div className="decision">
                          <b>위험성평가에 등록</b>
                          <select name="cause" aria-label="원인" defaultValue="">
                            <option value="">원인 (선택)</option>
                            {causes.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                          </select>
                          <label>가능성 <select name="likelihood" defaultValue="">{['', 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n || '-'}</option>)}</select></label>
                          <label>중대성 <select name="severity" defaultValue="">{['', 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n || '-'}</option>)}</select></label>
                          <input type="text" name="current_measure" placeholder="현재 안전보건조치 (선택)" aria-label="현재 안전보건조치" />
                          <button className="btn primary small" type="submit" formAction={registerFinding}>신규 위험요인으로 등록</button>
                        </div>
                      )}
                    </>
                  )}
                </fieldset>
              </form>
            </div>
          </div>
        );
      })}
    </main>
  );
}
