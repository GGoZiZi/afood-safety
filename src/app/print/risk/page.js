import { improvementThreshold } from '@/lib/db';
import { riskClass } from '@/lib/format';
import { listProcesses, searchRisks } from '@/lib/risk';
import { currentYear } from '@/lib/year';
import PrintButton from '@/components/PrintButton';

// 엑셀 "위험성평가표" 시트와 같은 모양: 공정마다 머리표 + 16칸 표. 미공개 항목은 빠진다.
export default async function PrintRisk({ searchParams }) {
  const sp = await searchParams;
  const year = await currentYear();
  const th = improvementThreshold();
  const rows = searchRisks(year, { ...sp, vis: '공개', deleted: '' });
  const procs = new Map(listProcesses(year).map((p) => [p.code, p]));
  const groups = [];
  for (const r of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.code !== r.process_code) {
      g = { code: r.process_code, proc: procs.get(r.process_code), items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }

  return (
    <div className="print-page">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print { .no-print { display: none !important; } body { background: #fff; } }
        .print-page { background: #fff; padding: 12px; font-size: 10pt; }
        .ra-block { break-inside: avoid; margin-bottom: 14px; }
        .ra-block + .ra-block { break-before: auto; }
        .ra-title { text-align: center; font-size: 15pt; font-weight: 700; border: 1px solid #000; padding: 6px; background: #f2f2f2; }
        table.ra { border-collapse: collapse; width: 100%; table-layout: fixed; }
        table.ra th, table.ra td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; word-break: keep-all; overflow-wrap: anywhere; }
        table.ra th { background: #e7e6e6; font-weight: 700; text-align: center; }
        table.ra td.c { text-align: center; }
        table.ra .head th { background: #d9e1f2; }
        .risk-high, .risk-top { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <PrintButton />
        <span>{year}년 · {groups.length}개 공정 · {rows.length}건 (미공개 제외) · A4 가로</span>
      </div>
      {groups.map((g) => (
        <section className="ra-block" key={g.code}>
          <div className="ra-title">위험성평가표</div>
          <table className="ra">
            <colgroup>
              <col style={{ width: '5%' }} /><col style={{ width: '7%' }} /><col style={{ width: '6%' }} /><col style={{ width: '5%' }} />
              <col style={{ width: '6%' }} /><col style={{ width: '7%' }} /><col style={{ width: '14%' }} /><col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} /><col style={{ width: '3.2%' }} /><col style={{ width: '3.2%' }} /><col style={{ width: '3.2%' }} />
              <col style={{ width: '11%' }} /><col style={{ width: '3.2%' }} /><col style={{ width: '3.2%' }} /><col style={{ width: '3.2%' }} />
            </colgroup>
            <tbody className="head">
              <tr>
                <th colSpan={2}>공간명</th><td colSpan={6}>{g.proc?.space ?? g.items[0].space}</td>
                <th colSpan={2}>공정ID</th><td colSpan={6}>{g.code}</td>
              </tr>
              <tr>
                <th colSpan={2}>공정명</th><td colSpan={6}>{g.proc?.name ?? g.items[0].process_name}</td>
                <th colSpan={2}>세부작업명</th><td colSpan={6}>{g.proc?.sub_task ?? g.items[0].sub_task}</td>
              </tr>
            </tbody>
            <tbody>
              <tr>
                <th>항목ID</th><th>공간명</th><th>공정명</th><th>세부작업명</th><th>분류</th><th>원인</th><th>유해위험요인</th><th>관련근거</th>
                <th>현재 안전보건조치</th><th>가능성</th><th>중대성</th><th>위험성</th><th>감소대책</th>
                <th>개선 후 가능성</th><th>개선 후 중대성</th><th>개선 후 위험성</th>
              </tr>
              {g.items.map((r) => (
                <tr key={r.id}>
                  <td className="c">{r.item_code}</td><td>{r.space}</td><td>{r.process_name}</td><td>{r.sub_task}</td>
                  <td>{r.category}</td><td>{r.cause}</td><td>{r.hazard}</td><td>{r.legal_basis}</td><td>{r.current_measure}</td>
                  <td className="c">{r.likelihood}</td><td className="c">{r.severity}</td>
                  <td className={`c ${riskClass(r.risk, th)}`}>{r.risk}</td>
                  <td>{r.reduction}</td>
                  <td className="c">{r.post_likelihood}</td><td className="c">{r.post_severity}</td><td className="c">{r.post_risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
