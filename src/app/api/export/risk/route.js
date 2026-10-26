import ExcelJS from 'exceljs';
import { improvementThreshold } from '@/lib/db';
import { RISK_FIELDS, searchRisks } from '@/lib/risk';
import { currentUser } from '@/lib/auth';
import { currentYear } from '@/lib/year';

// 대장 화면의 조건 그대로 엑셀로 내보낸다. 열 순서는 기존 "위험성평가_수정추가" 시트와 같게.
export async function GET(req) {
  if (!(await currentUser())) return new Response('로그인이 필요합니다.', { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const year = await currentYear();
  const th = improvementThreshold();
  const rows = searchRisks(year, sp);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('위험성평가');
  const cols = RISK_FIELDS.filter(([k]) => k !== 'process_code');
  ws.columns = cols.map(([key, header]) => ({
    key,
    header,
    width: ['hazard', 'current_measure', 'reduction'].includes(key) ? 45 : ['legal_basis', 'space', 'cause', 'category'].includes(key) ? 24 : 12,
  }));
  for (const r of rows) ws.addRow(r);

  const head = ws.getRow(1);
  head.font = { bold: true };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECEAE4' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  const riskCol = cols.findIndex(([k]) => k === 'risk') + 1;
  ws.eachRow((row, n) => {
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((c) => { c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
    if (n > 1 && Number(row.getCell(riskCol).value) >= th) {
      row.getCell(riskCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2E1' } };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const name = encodeURIComponent(`에이푸드 위험성평가 대장_${year}.xlsx`);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${name}`,
    },
  });
}
