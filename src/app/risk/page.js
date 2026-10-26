import Link from 'next/link';
import { improvementThreshold } from '@/lib/db';
import { listDepts, listProcesses, riskSummary, searchRisks } from '@/lib/risk';
import { currentYear, isClosed } from '@/lib/year';
import { riskClass } from '@/lib/format';
import { setVisibility } from './actions';
import { requireUser } from '@/lib/auth';

const STATUS_CHIP = { 신규: 'new', 수정: 'edit', 기존: 'old' };

function query(params, patch) {
  const q = new URLSearchParams({ ...params, ...patch });
  for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
  return q.toString();
}

export default async function RiskLedger({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    dept: sp.dept || '', process: sp.process || '', minRisk: sp.minRisk || '', vis: sp.vis || '',
    status: sp.status || '', q: sp.q || '', deleted: sp.deleted || '',
  };
  const year = await currentYear();
  const closed = isClosed(year);
  const th = improvementThreshold();
  const rows = searchRisks(year, filters);
  const sum = riskSummary(year);
  const depts = listDepts(year);
  const processes = listProcesses(year).filter((p) => !filters.dept || p.dept === filters.dept);
  const qs = query(filters, {});

  return (
    <main>
      <h1>{year}년 위험성평가 대장</h1>
      <p className="sub">
        위험요인 {sum.total}건 · 개선대상({th}점 이상) {sum.over}건 · 미공개 {sum.hidden}건
        {sum.missing ? ` · 점수 미입력 ${sum.missing}건` : ''}
        {closed && ' · 마감된 연도(읽기 전용)'}
      </p>

      <form className="filters" method="get">
        <label>부서
          <select name="dept" defaultValue={filters.dept}>
            <option value="">전체</option>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label>공정
          <select name="process" defaultValue={filters.process}>
            <option value="">전체 ({processes.length})</option>
            {processes.map((p) => <option key={p.code} value={p.code}>{p.code} {p.name}</option>)}
          </select>
        </label>
        <label>위험성
          <select name="minRisk" defaultValue={filters.minRisk}>
            <option value="">전체</option>
            <option value="over">{th}점 이상 (개선대상)</option>
            <option value="missing">점수 미입력</option>
          </select>
        </label>
        <label>공개
          <select name="vis" defaultValue={filters.vis}>
            <option value="">공개+미공개</option>
            <option>공개</option>
            <option>미공개</option>
          </select>
        </label>
        <label>작업구분
          <select name="status" defaultValue={filters.status}>
            <option value="">전체</option>
            <option>기존</option>
            <option>신규</option>
            <option>수정</option>
          </select>
        </label>
        <label>보기
          <select name="deleted" defaultValue={filters.deleted}>
            <option value="">사용 중 항목</option>
            <option value="1">삭제한 항목</option>
          </select>
        </label>
        <label className="grow">검색
          <input type="search" name="q" defaultValue={filters.q} placeholder="유해위험요인, 항목ID, 대책, 공정명" />
        </label>
        <button className="btn" type="submit">조회</button>
        <div className="actions">
          <a className="btn" href={`/api/export/risk?${qs}`}>엑셀 내보내기</a>
          <Link className="btn" href={`/print/risk?${qs}`} target="_blank">위험성평가표 인쇄</Link>
          {!closed && <Link className="btn primary" href={`/risk/new${filters.process ? `?process=${filters.process}` : ''}`}>+ 위험요인 추가</Link>}
        </div>
      </form>

      <p className="stats"><span><b>{rows.length}</b>건 표시</span>{(qs && <Link href="/risk">조건 지우기</Link>)}</p>

      <div className="table-wrap">
        <table className="sheet">
          <thead>
            <tr>
              <th>항목ID</th>
              <th>구분</th>
              <th className="mid">공정명</th>
              <th className="mid">세부작업</th>
              <th className="mid">분류 / 원인</th>
              <th className="hazard">유해위험요인</th>
              <th className="wide">현재 안전보건조치</th>
              <th className="num">가능성</th>
              <th className="num">중대성</th>
              <th className="num">위험성</th>
              <th className="wide">감소대책</th>
              <th className="num">개선후</th>
              <th>조치담당</th>
              <th>조치예정일</th>
              <th className="num">사진</th>
              <th>공개</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.visibility === '미공개' ? 'hidden-row' : ''}>
                <td className="nowrap"><Link href={`/risk/${r.id}`}>{r.item_code}</Link></td>
                <td className="nowrap"><span className={`chip ${STATUS_CHIP[r.work_status] ?? 'old'}`}>{r.work_status}</span></td>
                <td>{r.process_name}</td>
                <td>{r.sub_task}</td>
                <td>{r.category}<br /><span style={{ color: 'var(--ink-soft)' }}>{r.cause}</span></td>
                <td className="hazard"><Link href={`/risk/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.hazard}</Link></td>
                <td className="wide">{r.current_measure}</td>
                <td className="num">{r.likelihood ?? ''}</td>
                <td className="num">{r.severity ?? ''}</td>
                <td className={`num ${riskClass(r.risk, th)}`}>{r.risk ?? '미입력'}</td>
                <td className="wide">{r.reduction}</td>
                <td className="num">{r.post_risk ?? ''}</td>
                <td>{r.action_owner}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.due_date}</td>
                <td className="num">{r.photo_count || ''}</td>
                <td>
                  {closed || r.deleted || user.role !== 'admin' ? (
                    r.visibility
                  ) : (
                    <form action={setVisibility}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="visibility" value={r.visibility === '공개' ? '미공개' : '공개'} />
                      <button className="btn small" type="submit" title="누르면 바뀝니다">
                        {r.visibility === '공개' ? '공개' : <span className="chip hidden">미공개</span>}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={16}>조건에 맞는 항목이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
