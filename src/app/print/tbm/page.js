import { requireUser } from '@/lib/auth';
import { label, translatedRules } from '@/lib/i18n';
import { DEFAULT_RULES, findMeeting, getDept, getOrCreateMeeting, isTbmDay, listTbmDepts, meetingFull, safetyRules, tbmDays, today } from '@/lib/tbm';
import PrintButton from '@/components/PrintButton';

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '');
const MAX_DAYS = 62;

function korDate(date) {
  const [y, m, d] = date.split('-');
  return `${y}년 ${m}월 ${d}일`;
}

const numbered = (items, key) => items.map((it, i) => `${i + 1}. ${it[key] ?? ''}`).join('\n');

// 엑셀 "부서(TBM)" 시트와 같은 한 장짜리 회의록. A4 세로 한 장에 하루.
function Sheet({ full, lang, rules }) {
  const { meeting: m, items, attendance, dept: d, caseText } = full;
  const L = (k) => label(k, lang);
  const cols = 3;
  const rows = Math.max(5, Math.ceil(attendance.length / cols));
  const grid = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => attendance[r * cols + c]));
  return (
    <section className="tbm-sheet">
      <div className="tbm-title">{L('title')}</div>
      <table className="tbm">
        <colgroup>
          {Array.from({ length: 12 }, (_, i) => <col key={i} style={{ width: `${100 / 12}%` }} />)}
        </colgroup>
        <tbody>
          <tr>
            <th colSpan={2}>{L('date')}</th>
            <td colSpan={10}>
              {korDate(m.date)}&nbsp;&nbsp;&nbsp;&nbsp;{m.time_text ?? ''}&nbsp;&nbsp;&nbsp;&nbsp;{L('sameDay')} (☑{L('yes')}, □{L('no')})
            </td>
          </tr>
          <tr><th colSpan={2}>{L('workName')}</th><td colSpan={10}>{m.work_name ?? ''}</td></tr>
          <tr><th colSpan={2}>{L('workContent')}</th><td colSpan={10}>{m.work_content ?? ''}</td></tr>
          <tr>
            <th colSpan={2}>{L('place')}</th><td colSpan={4}>{m.place ?? ''}</td>
            <th colSpan={3}>{L('raDone')}</th>
            <td colSpan={3} className="c">{L('yes')} {m.ra_done ? '☑' : '□'}&nbsp;&nbsp;&nbsp;{L('no')} {m.ra_done ? '□' : '☑'}</td>
          </tr>
          <tr><th colSpan={6}>{L('hazards')}</th><th colSpan={6}>{L('measures')}</th></tr>
          <tr className="tall">
            <td colSpan={6} className="pre">{numbered(items, 'hazard')}</td>
            <td colSpan={6} className="pre">{numbered(items, 'measure')}</td>
          </tr>
          <tr><th colSpan={6}>{L('nearMiss')}</th><th colSpan={6}>{L('cases')}</th></tr>
          <tr className="mid">
            <td colSpan={6} className="pre">{m.near_miss ?? ''}</td>
            <td colSpan={6} className="pre small">{caseText}</td>
          </tr>
          <tr>
            <th colSpan={3}>{L('leader')}</th>
            <td colSpan={9}>
              • {L('affil')} : {d?.leader_affil ?? ''}&nbsp;&nbsp;&nbsp;&nbsp;• {L('position')} : {d?.leader_title ?? ''}&nbsp;&nbsp;&nbsp;&nbsp;• {L('name')} : {d?.leader_name ?? ''}
              <span className="sign-slot">({L('sign')})</span>
            </td>
          </tr>
          <tr><th colSpan={12} className="left">■ {L('rules')}</th></tr>
          <tr><td colSpan={12} className="pre">{rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}</td></tr>
          <tr><th colSpan={12} className="left">{L('special')}</th></tr>
          <tr className="note"><td colSpan={12} className="pre">{m.special_note ?? ''}</td></tr>
          <tr><th colSpan={12} className="left">■ {L('attendees')}</th></tr>
          <tr>
            {Array.from({ length: cols }, (_, i) => [
              <th key={`n${i}`} colSpan={2}>{L('attName')}</th>,
              <th key={`s${i}`} colSpan={2}>{L('sign')}</th>,
            ])}
          </tr>
          {grid.map((row, r) => (
            <tr key={r} className="att">
              {row.map((a, c) => [
                <td key={`n${c}`} colSpan={2} className="c">{a?.name ?? ''}</td>,
                <td key={`s${c}`} colSpan={2} className="c away">{a && a.status !== '참석' ? a.status : ''}</td>,
              ])}
            </tr>
          ))}
        </tbody>
      </table>
      {m.status !== '완료' && <p className="no-print draft">작성중인 회의록입니다 (출력은 가능)</p>}
    </section>
  );
}

export default async function PrintTbm({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  const lang = sp.lang ?? 'ko';
  const single = isDate(sp.date) ? sp.date : null;
  const from = single ?? (isDate(sp.from) ? sp.from : today());
  const to = single ?? (isDate(sp.to) && sp.to >= from ? sp.to : from);
  const depts = sp.dept ? [getDept(sp.dept)].filter(Boolean) : listTbmDepts();

  // 출력 대상: 실시 요일 + 이미 만든 회의록. 부서와 날짜를 콕 집으면 실시일이 아니어도 출력.
  const sheets = [];
  let truncated = false;
  for (const d of depts) {
    let days;
    if (single) days = sp.dept || isTbmDay(d, single) || findMeeting(d.code, single) ? [single] : [];
    else {
      const all = tbmDays(d, from, to);
      if (all.length > MAX_DAYS) { truncated = true; all.length = MAX_DAYS; }
      days = all;
    }
    for (const day of days) sheets.push(meetingFull(getOrCreateMeeting(d.code, day)));
  }
  if (!single) sheets.sort((a, b) => a.meeting.dept.localeCompare(b.meeting.dept) || a.meeting.date.localeCompare(b.meeting.date));

  const base = safetyRules();
  const isDefault = base.length === DEFAULT_RULES.length && base.every((r, i) => r === DEFAULT_RULES[i]);
  const rules = isDefault ? translatedRules(base, lang) : base;

  return (
    <div className="print-page">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print { .no-print { display: none !important; } body { background: #fff; } .print-page { padding: 0 !important; } }
        .print-page { background: #fff; padding: 12px; font-size: 10pt; color: #000; }
        .tbm-sheet { max-width: 190mm; margin: 0 auto 18px; break-after: page; }
        .tbm-sheet:last-child { break-after: auto; }
        .tbm-title { text-align: center; font-size: 17pt; font-weight: 700; border: 2px solid #000; border-bottom: 0; padding: 8px; }
        table.tbm { border-collapse: collapse; width: 100%; table-layout: fixed; border: 2px solid #000; }
        table.tbm th, table.tbm td { border: 1px solid #000; padding: 4px 5px; vertical-align: middle; word-break: keep-all; overflow-wrap: anywhere; line-height: 1.45; }
        table.tbm th { background: #f2f2f2; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        table.tbm th.left { text-align: left; }
        table.tbm td.c { text-align: center; }
        table.tbm td.pre { white-space: pre-line; vertical-align: top; }
        table.tbm td.small { font-size: 9pt; }
        table.tbm tr.tall td { height: 46mm; }
        table.tbm tr.mid td { height: 26mm; }
        table.tbm tr.note td { height: 12mm; }
        table.tbm tr.att td { height: 9mm; }
        table.tbm td.away { color: #555; font-size: 9pt; }
        .sign-slot { float: right; color: #444; }
        .draft { color: #b42318; font-size: 12px; margin: 4px 0 0; }
      `}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <PrintButton />
        <span>
          {single ?? `${from} ~ ${to}`} · {sheets.length}장 · A4 세로
          {truncated && ` · 부서당 최대 ${MAX_DAYS}일까지만 출력합니다`}
        </span>
      </div>
      {sheets.length === 0 && <p>이 기간에는 TBM 실시일이 없습니다. TBM 설정에서 실시 요일을 확인하세요.</p>}
      {sheets.map((f) => <Sheet key={f.meeting.id} full={f} lang={lang} rules={rules} />)}
    </div>
  );
}
