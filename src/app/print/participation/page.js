import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PT, participantItems } from '@/lib/participation';
import { currentYear } from '@/lib/year';
import PrintButton from '@/components/PrintButton';

const t = (k, lang) => PT[k][lang] ?? PT[k].ko;

// 기존 "근로자 위험성평가 참여" 엑셀 모양: 공정마다 왼쪽(평가 점수) · 오른쪽(근로자 기입란, 외국인은 번역)
function Half({ g, lang, worker, blank }) {
  const tr = lang !== 'ko';
  const first = g.items[0];
  return (
    <table className="pt">
      <colgroup>
        <col style={{ width: '9%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} /><col style={{ width: '11%' }} />
        <col style={{ width: '36%' }} /><col style={{ width: '6%' }} /><col style={{ width: '6%' }} /><col style={{ width: '6%' }} />
      </colgroup>
      <tbody>
        <tr><th colSpan={8} className="pt-title">{t('title', lang)}</th></tr>
        <tr><th colSpan={2}>{t('space', lang)}</th><td colSpan={6}>{(tr && first.t_space) || first.space}</td></tr>
        <tr><th colSpan={2}>{t('process', lang)}</th><td colSpan={3}>{(tr && first.t_process) || first.process_name}</td><td colSpan={3} className="c"><b>{worker}</b></td></tr>
        <tr>
          <th>{t('itemId', lang)}</th><th>{t('space', lang)}</th><th>{t('process', lang)}</th><th>{t('subTask', lang)}</th>
          <th>{t('hazard', lang)}</th><th>{t('likelihood', lang)}</th><th>{t('severity', lang)}</th><th>{t('risk', lang)}</th>
        </tr>
        {g.items.map((r) => (
          <tr key={r.id}>
            <td className="c">{r.item_code}</td>
            <td>{(tr && r.t_space) || r.space}</td>
            <td>{(tr && r.t_process) || r.process_name}</td>
            <td>{(tr && r.t_sub) || r.sub_task}</td>
            <td>{(tr && r.t_hazard) || r.hazard}</td>
            <td className="c">{blank ? '' : r.likelihood}</td>
            <td className="c">{blank ? '' : r.severity}</td>
            <td className="c">{blank ? '' : r.risk}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function PrintParticipation({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  const db = getDb();
  const year = Number(sp.year) || (await currentYear());
  const people = sp.id
    ? db.prepare('SELECT * FROM participants WHERE id = ?').all(Number(sp.id))
    : db.prepare('SELECT * FROM participants WHERE year = ? ORDER BY dept, sort, name').all(year);

  const sheets = people.map((p) => {
    const groups = [];
    for (const r of participantItems(p)) {
      let g = groups[groups.length - 1];
      if (!g || g.code !== r.process_code) groups.push((g = { code: r.process_code, items: [] }));
      g.items.push(r);
    }
    return { p, groups };
  }).filter((s) => s.groups.length);

  return (
    <div className="print-page">
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print { .no-print { display: none !important; } body { background: #fff; } .print-page { padding: 0 !important; } }
        .print-page { background: #fff; padding: 12px; font-size: 8.5pt; color: #000; }
        .person { break-after: page; }
        .person:last-child { break-after: auto; }
        .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-bottom: 5mm; break-inside: auto; }
        table.pt { border-collapse: collapse; width: 100%; table-layout: fixed; }
        table.pt th, table.pt td { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; word-break: keep-all; overflow-wrap: anywhere; line-height: 1.3; }
        table.pt th { background: #e7e6e6; text-align: center; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        table.pt .pt-title { font-size: 12pt; background: #fff; }
        table.pt td.c { text-align: center; }
        table.pt tr { break-inside: avoid; }
        .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
        .sign div { border: 1px solid #000; padding: 6px; min-height: 16mm; }
      `}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <PrintButton />
        <span>근로자 {sheets.length}명 · A4 가로 · 오른쪽 칸은 근로자가 직접 점수를 적습니다</span>
      </div>
      {sheets.length === 0 && <p>출력할 평가지가 없습니다. 근로자의 담당 공정을 먼저 고르세요.</p>}
      {sheets.map(({ p, groups }) => (
        <section key={p.id} className="person">
          {groups.map((g) => (
            <div key={g.code} className="pair">
              <Half g={g} lang="ko" worker={p.name} />
              <Half g={g} lang={p.lang} worker={p.name} blank />
            </div>
          ))}
          <div className="sign">
            <div>{t('opinion', 'ko')}{p.lang !== 'ko' ? ` / ${t('opinion', p.lang)}` : ''} :</div>
            <div>{t('sign', 'ko')}{p.lang !== 'ko' ? ` / ${t('sign', p.lang)}` : ''} : {p.name}</div>
          </div>
        </section>
      ))}
    </div>
  );
}
