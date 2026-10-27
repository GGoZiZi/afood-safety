import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { agentList, listPeople } from '@/lib/health';
import { addDays, today } from '@/lib/tbm';
import PrintButton from '@/components/PrintButton';

const OX = (v) => (v ? 'O' : 'X');
// 1979-11-17 + 남 → 791117-1 (기존 명단과 같은 모양)
function rrnFront(p) {
  if (!p.birth) return '';
  const [y, m, d] = p.birth.split('-');
  const n = (y >= '2000' ? 2 : 0) + (p.sex === '여' ? 2 : 1);
  return `${y.slice(2)}${m}${d}${p.sex ? `-${n}` : ''}`;
}
const WD = ['일', '월', '화', '수', '목', '금', '토'];

// 기존 "일반/특수/보건증 등 출장 건강진단" 명단 모양
export default async function PrintHealth({ searchParams }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/tbm');
  const sp = await searchParams;
  // 가져온 명단 순서 그대로 (새로 추가한 사람은 뒤에)
  let people = listPeople().sort((a, b) => a.id - b.id);
  if (sp.dept) people = people.filter((p) => p.dept === sp.dept);
  // todo: 앞으로 90일 안에 받을 검진이 있는 사람만
  const now = today();
  const soon = sp.todo ? addDays(now, 90) : null;
  if (soon) people = people.filter((p) => p.dues.some((d) => !d.due || d.due <= soon));
  const [y, m, d] = now.split('-');
  const wd = WD[new Date(`${now}T00:00:00`).getDay()];

  return (
    <div className="print-page">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print { .no-print { display: none !important; } body { background: #fff; } .print-page { padding: 0 !important; } }
        .print-page { background: #fff; padding: 12px; font-size: 9pt; color: #000; }
        h1.t { text-align: center; font-size: 15pt; margin: 0 0 4mm; }
        .base { margin-bottom: 2mm; }
        table.hl { border-collapse: collapse; width: 100%; }
        table.hl th, table.hl td { border: 1px solid #000; padding: 3px 4px; text-align: center; word-break: keep-all; white-space: nowrap; }
        table.hl th { background: #d9e1f2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        table.hl td.l { text-align: left; white-space: normal; }
        table.hl tr { break-inside: avoid; }
      `}</style>
      <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <PrintButton />
        <span>{people.length}명 · A4 가로</span>
        <a href={`/print/health?${new URLSearchParams({ ...(sp.dept && { dept: sp.dept }), ...(!sp.todo && { todo: '1' }) })}`}>
          {sp.todo ? '전체 명단 보기' : '90일 안에 검진할 사람만 보기'}
        </a>
      </div>
      <h1 className="t">{y}년 일반/특수/보건증 등 출장 건강진단</h1>
      <div className="base">작성 기준일자: {y}. {Number(m)}. {Number(d)}({wd})</div>
      <table className="hl">
        <thead>
          <tr><th>No</th><th>부서</th><th>성명</th><th>생년월일</th><th>성별</th><th>야간근로</th><th>입사일</th><th>핸드폰번호</th><th>일반건강진단</th><th>특수건강진단</th><th>보건증</th></tr>
        </thead>
        <tbody>
          {people.map((p, i) => {
            const ag = agentList(p);
            return (
              <tr key={p.id}>
                <td>{i + 1}</td><td>{p.dept}</td><td>{p.name}</td><td>{rrnFront(p)}</td><td>{p.sex}</td>
                <td>{OX(p.night_work)}</td><td>{p.hire_date}</td><td>{p.phone}</td><td>{OX(p.general)}</td>
                <td className={ag.length ? 'l' : ''}>{ag.length ? ag.map((a, k) => `${k + 1}. ${a}`).join(' ') : 'X'}</td>
                <td>{OX(p.food_cert)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
