import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canEditDept, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { LANGS } from '@/lib/i18n';
import { ATTEND_STATUS, WEEKDAY_LABEL, deptRiskOptions, getDept, getOrCreateMeeting, meetingFull, meetingHistory, weekday } from '@/lib/tbm';
import TbmItems from '@/components/TbmItems';
import { completeMeeting, removeAttendee, reopenMeeting, saveMeeting } from '../../actions';

export default async function TbmMeeting({ params, searchParams }) {
  const user = await requireUser();
  const { dept: rawDept, date } = await params;
  const sp = await searchParams;
  const dept = decodeURIComponent(rawDept);
  if (!getDept(dept) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const meeting = getOrCreateMeeting(dept, date);
  const { items, attendance, dept: d, cases, caseText } = meetingFull(meeting);
  const canEdit = canEditDept(user, dept);
  const locked = meeting.status === '완료' || !canEdit;
  const options = deptRiskOptions(meeting.year, dept);
  const history = meetingHistory(meeting.id);
  const year = getDb().prepare('SELECT year FROM years WHERE year = ?').get(meeting.year);

  return (
    <main>
      <p><Link href={`/tbm?date=${date}`}>← {date} TBM 목록</Link></p>
      <h1>{dept} TBM · {date} ({WEEKDAY_LABEL[weekday(date)]})</h1>
      <p className="sub">
        {meeting.status === '완료' ? `완료 · ${meeting.completed_by} · ${meeting.completed_at}` : '작성중'}
        {' · '}올해 {meeting.seq}번째 TBM{!year && ` · ${meeting.year}년 위험성평가가 없어 위험요인이 비어 있을 수 있습니다`}
        {!canEdit && ' · 보기 전용 (다른 부서)'}
      </p>
      {sp.saved && <div className="notice">저장했습니다.</div>}

      <div className="form-actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <form method="get" action="/print/tbm" target="_blank" style={{ display: 'flex', gap: 6 }}>
          <input type="hidden" name="dept" value={dept} />
          <input type="hidden" name="date" value={date} />
          <select name="lang" defaultValue="ko" aria-label="출력 언어">
            {LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn" type="submit">출력</button>
        </form>
        {canEdit && meeting.status !== '완료' && (
          <form action={completeMeeting}>
            <input type="hidden" name="id" value={meeting.id} />
            <button className="btn primary" type="submit">TBM 완료</button>
          </form>
        )}
        {canEdit && meeting.status === '완료' && (
          <form action={reopenMeeting}>
            <input type="hidden" name="id" value={meeting.id} />
            <button className="btn" type="submit">수정하기 (완료 취소)</button>
          </form>
        )}
      </div>

      <form action={saveMeeting}>
        <input type="hidden" name="id" value={meeting.id} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="card">
            <div className="form-grid">
              <label><span>TBM 시간</span><input type="text" name="time_text" defaultValue={meeting.time_text ?? ''} /></label>
              <label><span>TBM 장소</span><input type="text" name="place" defaultValue={meeting.place ?? ''} /></label>
              <label className="span2"><span>작업명</span><input type="text" name="work_name" defaultValue={meeting.work_name ?? ''} /></label>
              <label className="span2"><span>작업내용</span><input type="text" name="work_content" defaultValue={meeting.work_content ?? ''} /></label>
              <label><span>위험성평가 실시여부</span>
                <select name="ra_done" defaultValue={String(meeting.ra_done)}>
                  <option value="1">예</option>
                  <option value="0">아니오</option>
                </select>
              </label>
              <label><span>TBM 리더</span><input type="text" value={`${d.leader_affil ?? ''} ${d.leader_title ?? ''} ${d.leader_name ?? ''}`} readOnly /></label>
            </div>
          </div>

          <TbmItems items={items} options={options} />

          <div className="card">
            <h2 style={{ marginTop: 0 }}>참석자 ({attendance.filter((a) => a.status === '참석').length} / {attendance.length})</h2>
            <p className="sub">연차·교육 등으로 빠지는 팀원은 상태를 바꾸면 출력물 서명칸에 표시됩니다.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {attendance.map((a) => (
                <label key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid var(--line-soft)', borderRadius: 8, background: a.status === '참석' ? '#fff' : 'var(--danger-soft)' }}>
                  <span style={{ flex: 1, fontWeight: 700 }}>{a.name}{a.lang && a.lang !== 'ko' ? ` (${a.lang})` : ''}</span>
                  <select name={`att:${a.name}`} defaultValue={a.status}>
                    {ATTEND_STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
              참석자 추가 (오늘만)<input type="text" name="add_attendee" placeholder="이름" />
            </label>
          </div>

          <div className="card">
            <div className="form-grid">
              <label className="span2"><span>아차사고 및 근로자 의견 청취</span><textarea name="near_miss" defaultValue={meeting.near_miss ?? ''} /></label>
              <label className="span2"><span>사고사례 공유 {meeting.case_text == null && cases.length > 0 ? `(재해사례 ${cases.length}건 자동)` : ''}</span>
                <textarea name="case_text" defaultValue={caseText} style={{ minHeight: 90 }} />
              </label>
              <label className="span4"><span>특기사항</span><textarea name="special_note" defaultValue={meeting.special_note ?? ''} /></label>
            </div>
          </div>

          {!locked && (
            <div className="form-actions"><button className="btn primary" type="submit">저장</button></div>
          )}
        </fieldset>
      </form>

      {!locked && attendance.length > 0 && (
        <details className="card">
          <summary>참석자 빼기 (퇴사·전배 등)</summary>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {attendance.map((a) => (
              <form key={a.name} action={removeAttendee}>
                <input type="hidden" name="id" value={meeting.id} />
                <input type="hidden" name="name" value={a.name} />
                <button className="btn small danger" type="submit">{a.name} 빼기</button>
              </form>
            ))}
          </div>
          <p className="sub" style={{ marginTop: 8 }}>매일 반복되는 명단 변경은 TBM 설정에서 팀원을 바꾸세요.</p>
        </details>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>기록</h2>
        <ul className="history">
          {history.map((h) => <li key={h.id}><b>{h.at}</b> {h.user_name ?? '자동'} · {h.action}{h.detail ? ` (${h.detail})` : ''}</li>)}
        </ul>
      </div>
    </main>
  );
}
