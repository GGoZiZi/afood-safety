import Link from 'next/link';
import { getDb, improvementThreshold } from '@/lib/db';
import { currentYear } from '@/lib/year';

export default async function ProcessesPage() {
  const year = await currentYear();
  const th = improvementThreshold();
  const procs = getDb()
    .prepare(`SELECT p.*,
        (SELECT COUNT(*) FROM risk_items r WHERE r.year = p.year AND r.process_code = p.code AND r.deleted = 0) AS risks,
        (SELECT COUNT(*) FROM risk_items r WHERE r.year = p.year AND r.process_code = p.code AND r.deleted = 0 AND r.risk >= ?) AS over
      FROM processes p WHERE p.year = ? ORDER BY p.seq, p.code`)
    .all(th, year);

  return (
    <main>
      <h1>{year}년 공정 목록</h1>
      <p className="sub">공정 {procs.length}개. 공정을 누르면 그 공정의 위험요인만 대장에서 봅니다. (공정 추가·수정 화면은 다음 단계에서 만듭니다)</p>
      <div className="table-wrap">
        <table className="sheet">
          <thead>
            <tr>
              <th>공정ID</th><th>구분</th><th>부서</th><th>공간명</th><th>공정명</th><th>세부작업명</th>
              <th className="wide">설비</th><th>물질</th><th>실행책임자</th><th>추진자</th>
              <th className="num">위험요인</th><th className="num">{th}점 이상</th>
            </tr>
          </thead>
          <tbody>
            {procs.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/risk?process=${p.code}`}>{p.code}</Link></td>
                <td>{p.work_status}</td>
                <td>{p.dept}</td>
                <td>{p.space}</td>
                <td>{p.name}</td>
                <td>{p.sub_task}</td>
                <td className="wide" style={{ whiteSpace: 'pre-line' }}>{p.equipment}</td>
                <td style={{ whiteSpace: 'pre-line' }}>{p.material}</td>
                <td>{p.owner}</td>
                <td>{p.promoter}</td>
                <td className="num">{p.risks}</td>
                <td className={`num ${p.over ? 'risk-high' : ''}`}>{p.over || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
