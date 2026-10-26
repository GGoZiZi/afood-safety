import Link from 'next/link';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { LANGS } from '@/lib/i18n';
import { WEEKDAY_LABEL, addDays, casesFor, findMeeting, isTbmDay, listTbmDepts, today, weekday } from '@/lib/tbm';
import { markCasesSeen } from './actions';

export default async function TbmHome({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date : today();
  const depts = listTbmDepts();
  // 관리감독자는 자기 부서가 맨 위
  depts.sort((a, b) => (b.code === user.dept) - (a.code === user.dept));

  const db = getDb();
  const rows = depts.map((d) => {
    const m = findMeeting(d.code, date);
    const att = m
      ? db.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN status != '참석' THEN 1 ELSE 0 END) AS away FROM tbm_attendance WHERE meeting_id = ?").get(m.id)
      : null;
    const first = m ? db.prepare('SELECT hazard FROM tbm_items WHERE meeting_id = ? ORDER BY slot LIMIT 1').get(m.id) : null;
    return { d, m, att, first, day: isTbmDay(d, date), cases: casesFor(d.code, date) };
  });

  // 새 재해사례 알림: 지금 공유 기간이고, 이 사용자가 아직 "확인"을 안 누른 사례
  const visible = new Map();
  for (const r of rows) if (user.role === 'admin' || r.d.code === user.dept) for (const c of r.cases) visible.set(c.id, c);
  const seen = new Set(db.prepare('SELECT case_id FROM case_seen WHERE user_id = ?').all(user.id).map((r) => r.case_id));
  const fresh = [...visible.values()].filter((c) => !seen.has(c.id));

  return (
    <main>
      <h1>TBM 일지</h1>
      <p className="sub">{date} ({WEEKDAY_LABEL[weekday(date)]}) · 부서를 누르면 그날 회의록이 자동으로 만들어집니다 (위험요인 4건 순환 배정)</p>

      {fresh.length > 0 && (
        <div className="notice" role="status">
          <strong>새 재해사례 {fresh.length}건</strong>이 TBM 사고사례 공유에 들어갑니다 (공유 시작일부터 7일간 매일).
          <ul style={{ margin: '6px 0' }}>
            {fresh.map((c) => (
              <li key={c.id}>
                <Link href={`/cases/${c.id}/cards`}>[{c.category}] {c.title.slice(0, 80)}{c.title.length > 80 ? '…' : ''}</Link>
                <span style={{ color: 'var(--ink-soft)' }}> · {c.depts} · {c.share_from}부터</span>
              </li>
            ))}
          </ul>
          <form action={markCasesSeen}>
            <input type="hidden" name="ids" value={fresh.map((c) => c.id).join(',')} />
            <button className="btn small" type="submit">확인했어요</button>
          </form>
        </div>
      )}

      <form className="filters" method="get">
        <label>날짜<input type="date" name="date" defaultValue={date} /></label>
        <button className="btn" type="submit">이동</button>
        <Link className="btn" href={`/tbm?date=${addDays(date, -1)}`}>← 전날</Link>
        <Link className="btn" href={`/tbm?date=${today()}`}>오늘</Link>
        <Link className="btn" href={`/tbm?date=${addDays(date, 1)}`}>다음날 →</Link>
        <div className="actions">
          {user.role === 'admin' && <Link className="btn" href="/tbm/settings">TBM 설정</Link>}
          <Link className="btn primary" href={`/print/tbm?date=${date}${user.role === 'admin' ? '' : `&dept=${encodeURIComponent(user.dept ?? '')}`}`} target="_blank">
            {user.role === 'admin' ? '이날 전체 부서 출력' : '우리 부서 출력'}
          </Link>
        </div>
      </form>

      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 900 }}>
          <thead>
            <tr><th>부서</th><th>TBM 리더</th><th>실시 요일</th><th>상태</th><th className="num">참석 / 대상</th><th className="hazard">오늘 첫 위험요인</th><th>사고사례</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(({ d, m, att, first, day, cases }) => (
              <tr key={d.code}>
                <td style={{ fontWeight: 700 }}>{d.code}{d.code === user.dept ? ' (우리 부서)' : ''}</td>
                <td>{d.leader_name}</td>
                <td>{d.weekdays.split(',').map((w) => WEEKDAY_LABEL[w]).join('·')}</td>
                <td>
                  {!m ? (day ? <span className="chip old">아직 없음</span> : <span className="chip old">실시일 아님</span>)
                    : m.status === '완료' ? <span className="chip ok">완료 {m.completed_by}</span>
                    : <span className="chip edit">작성중</span>}
                </td>
                <td className="num">{att ? `${att.n - (att.away ?? 0)} / ${att.n}` : ''}</td>
                <td className="hazard">{first?.hazard ?? ''}</td>
                <td>{cases.length ? `${cases.length}건` : ''}</td>
                <td className="nowrap">
                  <Link className="btn small" href={`/tbm/${encodeURIComponent(d.code)}/${date}`}>{m ? '열기' : '만들기'}</Link>{' '}
                  <Link className="btn small" href={`/print/tbm?date=${date}&dept=${encodeURIComponent(d.code)}`} target="_blank">출력</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>기간 일괄 출력</h2>
      <form className="filters" method="get" action="/print/tbm" target="_blank">
        <label>부서
          <select name="dept" defaultValue={user.role === 'admin' ? '' : user.dept ?? ''}>
            {user.role === 'admin' && <option value="">전체 부서</option>}
            {depts.map((d) => <option key={d.code}>{d.code}</option>)}
          </select>
        </label>
        <label>시작일<input type="date" name="from" defaultValue={date} /></label>
        <label>종료일<input type="date" name="to" defaultValue={addDays(date, 6)} /></label>
        <label>언어
          <select name="lang" defaultValue="ko">
            {LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button className="btn" type="submit">출력 화면 열기</button>
        <span className="sub" style={{ margin: 0 }}>실시 요일만 출력되고, 없는 날짜는 자동으로 만들어집니다.</span>
      </form>
    </main>
  );
}
