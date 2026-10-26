import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { LANGS } from '@/lib/i18n';
import { participantItems } from '@/lib/participation';
import { listProcesses } from '@/lib/risk';
import { deleteParticipant, reflectScore, saveParticipant, saveScores } from '../actions';

export default async function ParticipantPage({ params }) {
  const user = await requireUser();
  const { id } = await params;
  const db = getDb();
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(Number(id));
  if (!p) notFound();
  const chosen = new Set(db.prepare('SELECT process_code FROM participant_processes WHERE participant_id = ?').all(p.id).map((r) => r.process_code));
  const procs = listProcesses(p.year);
  const items = participantItems(p);
  const depts = [...new Set(procs.map((x) => x.dept).filter(Boolean))];

  return (
    <main>
      <p><Link href="/participation">← 근로자 참여</Link></p>
      <h1>{p.name} · {p.year}년 위험성평가 참여</h1>
      <p className="sub">{p.dept ?? '부서 미지정'} · 담당 공정 {chosen.size}개 · 평가 항목 {items.length}건</p>
      <div className="form-actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <Link className="btn" href={`/print/participation?id=${p.id}`} target="_blank">평가지 출력</Link>
      </div>

      <details className="card" open={chosen.size === 0}>
        <summary>담당 공정 · 언어 바꾸기</summary>
        <form action={saveParticipant} style={{ marginTop: 10 }}>
          <input type="hidden" name="id" value={p.id} />
          <div className="form-grid">
            <label><span>부서</span>
              <input type="text" name="dept" list="dept-list" defaultValue={p.dept ?? ''} />
              <datalist id="dept-list">{depts.map((d) => <option key={d} value={d} />)}</datalist>
            </label>
            <label><span>평가지 언어</span>
              <select name="lang" defaultValue={p.lang}>{LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4, margin: '12px 0' }}>
            {procs.map((x) => (
              <label key={x.code} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" name="procs" value={x.code} defaultChecked={chosen.has(x.code)} />{x.code} {x.dept} · {x.name}
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn primary small" type="submit">저장</button>
            {user.role === 'admin' && <button className="btn small danger" type="submit" formAction={deleteParticipant}>이 근로자 빼기</button>}
          </div>
        </form>
      </details>

      <form action={saveScores}>
        <input type="hidden" name="id" value={p.id} />
        <p className="sub">근로자가 평가지에 적은 가능성·중대성과 의견을 옮겨 적고 저장하세요. 평가 점수와 다르면 노란색으로 표시되고, "반영"을 누르면 위험성평가 점수가 근로자 점수로 바뀝니다 (이력에 남음).</p>
        <div className="table-wrap">
          <table className="sheet" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>항목ID</th><th>공정</th><th className="hazard">유해위험요인</th>
                <th className="num">평가 가능성</th><th className="num">중대성</th><th className="num">위험성</th>
                <th>근로자 가능성</th><th>중대성</th><th className="num">위험성</th><th>의견</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const wr = r.w_l && r.w_s ? r.w_l * r.w_s : null;
                const differ = wr != null && wr !== r.risk;
                return (
                  <tr key={r.id} className={differ && !r.reflected ? 'diff' : ''}>
                    <td className="nowrap"><Link href={`/risk/${r.id}`}>{r.item_code}</Link><input type="hidden" name="item" value={r.id} /></td>
                    <td>{r.process_name}</td>
                    <td className="hazard">{r.hazard}{r.t_hazard && <div style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{r.t_hazard}</div>}</td>
                    <td className="num">{r.likelihood}</td><td className="num">{r.severity}</td><td className="num">{r.risk}</td>
                    <td>
                      <select name={`l_${r.id}`} defaultValue={r.w_l ?? ''} aria-label={`${r.item_code} 근로자 가능성`}>
                        <option value="">-</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </td>
                    <td>
                      <select name={`s_${r.id}`} defaultValue={r.w_s ?? ''} aria-label={`${r.item_code} 근로자 중대성`}>
                        <option value="">-</option>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="num">{wr ?? ''}</td>
                    <td><input type="text" name={`o_${r.id}`} defaultValue={r.opinion ?? ''} aria-label={`${r.item_code} 의견`} style={{ minWidth: 160 }} /></td>
                    <td className="nowrap">
                      {r.reflected ? <span className="chip ok">반영함</span>
                        : differ ? <button className="btn small" type="submit" formAction={reflectScore.bind(null, r.id)}>반영</button> : ''}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={11}>담당 공정을 먼저 고르세요.</td></tr>}
            </tbody>
          </table>
        </div>
        {items.length > 0 && <div className="form-actions"><button className="btn primary" type="submit">점수·의견 저장</button></div>}
      </form>
    </main>
  );
}
