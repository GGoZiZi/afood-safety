import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { STATUS_CHIP, listImprovements } from '@/lib/improve';
import { riskClass } from '@/lib/format';
import { listDepts } from '@/lib/risk';
import { photoUrl } from '@/lib/upload';
import { currentYear, isClosed } from '@/lib/year';
import { saveFindingImprovement, saveRiskImprovement } from './actions';

const STATUSES = ['미계획', '진행중', '지연', '완료'];

export default async function ImprovePage({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  const year = await currentYear();
  const closed = isClosed(year);
  // 처음 열면 완료되지 않은 것만
  const status = sp.status ?? '';
  const { rows, counts, threshold } = listImprovements(year, { status: status === '' ? undefined : status, dept: sp.dept, source: sp.source });
  const list = status === '' && !sp.all ? rows.filter((r) => r.status !== '완료') : rows;
  const q = (patch) => {
    const u = new URLSearchParams({ ...(sp.dept && { dept: sp.dept }), ...(sp.source && { source: sp.source }), ...patch });
    return `/improve?${u}`;
  };

  return (
    <main>
      <h1>개선조치</h1>
      <p className="sub">{year}년 위험성 {threshold}점 이상 위험요인과, 위험성평가에 올리지 않은 순회점검 지적사항의 조치 계획·완료를 관리합니다.</p>

      <div className="stat-row">
        <Link className={`stat ${status === '' ? 'on' : ''}`} href={q({})}><b>{counts.전체 - counts.완료}</b><span>남은 조치</span></Link>
        {STATUSES.map((s) => (
          <Link key={s} className={`stat ${status === s ? 'on' : ''} ${s === '지연' && counts[s] ? 'warn' : ''}`} href={q({ status: s })}>
            <b>{counts[s]}</b><span>{s}</span>
          </Link>
        ))}
      </div>

      <form className="filters" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <label>부서
          <select name="dept" defaultValue={sp.dept ?? ''}>
            <option value="">전체</option>
            {listDepts(year).map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label>구분
          <select name="source" defaultValue={sp.source ?? ''}>
            <option value="">전체</option>
            <option value="risk">위험성평가</option>
            <option value="patrol">순회점검</option>
          </select>
        </label>
        <button className="btn" type="submit">보기</button>
      </form>

      {list.length === 0 && <p>해당하는 조치가 없습니다.</p>}
      {list.map((r) => (
        <form key={`${r.kind}${r.id}`} action={r.kind === 'risk' ? saveRiskImprovement : saveFindingImprovement} className="card improve-card">
          <input type="hidden" name="id" value={r.id} />
          <div className="improve-head">
            <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span>
            {r.kind === 'risk'
              ? <Link href={`/risk/${r.id}`}><b>{r.code}</b></Link>
              : <Link href={`/patrol/${r.patrolId}`}><b>{r.code}</b></Link>}
            <span className="sub" style={{ margin: 0 }}>{r.dept ?? ''} · {r.process ?? ''}</span>
            {r.risk != null && <span className={`score ${riskClass(r.risk, threshold)}`}>{r.risk}점</span>}
            {r.post_risk != null && <span className="sub" style={{ margin: 0 }}>→ 개선 후 {r.post_risk}점</span>}
          </div>
          <p style={{ margin: '6px 0 10px' }}>{r.hazard}</p>
          <fieldset disabled={closed && r.kind === 'risk'}>
            <div className="form-grid">
              <label className="span2"><span>감소대책</span>
                <textarea name={r.kind === 'risk' ? 'reduction' : 'measure'} defaultValue={r.measure ?? ''} />
              </label>
              <label><span>조치담당자</span><input type="text" name={r.kind === 'risk' ? 'action_owner' : 'owner'} defaultValue={r.owner ?? ''} /></label>
              <label><span>조치예정일</span><input type="date" name="due_date" defaultValue={r.due_date ?? ''} /></label>
              <label><span>완료일</span><input type="date" name="done_date" defaultValue={r.done_date ?? ''} /></label>
              {r.kind === 'risk' && (
                <>
                  <label><span>개선 후 가능성</span>
                    <select name="post_likelihood" defaultValue={r.row.post_likelihood ?? ''}>
                      <option value="">-</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </label>
                  <label><span>개선 후 중대성</span>
                    <select name="post_severity" defaultValue={r.row.post_severity ?? ''}>
                      <option value="">-</option>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </label>
                </>
              )}
              <label><span>개선 후 사진 {r.after ? `(${r.after}장 있음)` : ''}</span>
                <input type="file" name="after_photo" accept="image/*" capture="environment" />
              </label>
            </div>
            <div className="form-actions" style={{ marginTop: 8 }}>
              {r.kind === 'patrol' && r.row.after_photo && (
                <a href={photoUrl(r.row.after_photo)} target="_blank" className="btn small">개선 후 사진 보기</a>
              )}
              <button className="btn primary small" type="submit">저장</button>
            </div>
          </fieldset>
        </form>
      ))}
      {status === '' && !sp.all && counts.완료 > 0 && (
        <p><Link href={q({ all: '1' })}>완료된 {counts.완료}건도 보기</Link></p>
      )}
    </main>
  );
}
