import ExcelJS from 'exceljs';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { budgetSummary } from '@/lib/budget';

// 기존 "위험성평가 예산편성 및 집행" + "집행내역" 시트 모양으로 내보내기
export async function GET(req) {
  const user = await currentUser();
  if (!user) return new Response('로그인이 필요합니다.', { status: 401 });
  if (user.role !== 'admin') return new Response('관리자만 내려받을 수 있습니다.', { status: 403 });
  const year = Number(new URL(req.url).searchParams.get('year'));
  const { rows, total, vat } = budgetSummary(year);
  const wb = new ExcelJS.Workbook();
  const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const s1 = wb.addWorksheet('위험성평가 예산편성 및 집행');
  s1.columns = [{ width: 38 }, { width: 16 }, { width: 60 }, { width: 16 }, { width: 10 }];
  s1.addRow([`${year}년 위험성평가 예산편성 및 집행`]).font = { bold: true, size: 14 };
  s1.addRow([' ■(필수) 1인당 2만원 이상 예산편성']);
  const head = s1.addRow(['구분', `${year}년 편성액`, '편성내역', `${year}년 집행내역`, '집행률']);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }; });
  const add = (vals) => {
    const r = s1.addRow(vals);
    r.eachCell({ includeEmpty: true }, (c, i) => { c.border = border; c.alignment = { vertical: 'middle', wrapText: true }; if (i === 2 || i === 4) c.numFmt = '#,##0'; });
    return r;
  };
  add(['합계', total.planned, '', total.spent, total.planned ? total.spent / total.planned : null]).font = { bold: true };
  for (const r of rows) add([r.category, r.planned, r.detail ?? '', r.spent, r.planned ? r.spent / r.planned : null]);
  s1.getColumn(5).numFmt = '0%';
  s1.addRow([]);
  s1.addRow([`집행액: ERP 계정내역 중 자동·확인 건, ${vat ? '부가세 포함' : '공급가'}`]);

  const s2 = wb.addWorksheet('집행내역');
  s2.columns = [
    { header: '구분', key: 'category', width: 36 }, { header: '회계일', key: 'date', width: 12 }, { header: '비고', key: 'memo', width: 60 },
    { header: '거래처', key: 'vendor', width: 24 }, { header: '금액', key: 'amount', width: 14 }, { header: '부가세', key: 'vat', width: 12 },
    { header: '합계', key: 'sum', width: 14 }, { header: '상태', key: 'status', width: 8 }, { header: '전표번호', key: 'voucher', width: 16 },
  ];
  s2.getRow(1).font = { bold: true };
  const list = getDb()
    .prepare("SELECT * FROM budget_entries WHERE year = ? AND status IN ('자동', '확인') ORDER BY category, date")
    .all(year);
  for (const e of list) s2.addRow({ ...e, sum: e.amount + (vat ? e.vat : 0) });
  for (const k of ['amount', 'vat', 'sum']) s2.getColumn(k).numFmt = '#,##0';

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${year}년 위험성평가 예산편성 및 집행.xlsx`)}`,
    },
  });
}
