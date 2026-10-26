import { getDb } from '@/lib/db';
import { createYear, toggleClosed } from './actions';

export default function YearsPage() {
  const years = getDb()
    .prepare(`SELECT y.*,
        (SELECT COUNT(*) FROM processes p WHERE p.year = y.year) AS procs,
        (SELECT COUNT(*) FROM risk_items r WHERE r.year = y.year AND r.deleted = 0) AS risks
      FROM years y ORDER BY y.year DESC`)
    .all();
  const latest = years[0]?.year;

  return (
    <main>
      <h1>연도 관리</h1>
      <p className="sub">새 평가연도는 전년도 공정·위험요인을 복사해서 시작합니다. 마감한 연도는 수정할 수 없고 기록으로 보존됩니다.</p>

      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table className="sheet" style={{ minWidth: 600 }}>
          <thead>
            <tr><th>연도</th><th>이름</th><th className="num">공정</th><th className="num">위험요인</th><th>상태</th><th></th></tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{y.title}</td>
                <td className="num">{y.procs}</td>
                <td className="num">{y.risks}</td>
                <td>{y.closed ? <span className="chip hidden">마감</span> : <span className="chip ok">진행중</span>}</td>
                <td>
                  <form action={toggleClosed}>
                    <input type="hidden" name="year" value={y.year} />
                    <button className="btn small" type="submit">{y.closed ? '마감 해제' : '마감'}</button>
                  </form>
                </td>
              </tr>
            ))}
            {years.length === 0 && (
              <tr><td colSpan={6}>아직 연도가 없습니다. 엑셀 가져오기(설치 안내서 참고)를 먼저 실행하거나 아래에서 새 연도를 만드세요.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={createYear} className="card">
        <h2 style={{ marginTop: 0 }}>새 평가연도 만들기</h2>
        <div className="filters" style={{ border: 0, padding: 0 }}>
          <label>연도<input type="number" name="year" required defaultValue={latest ? latest + 1 : new Date().getFullYear()} /></label>
          <label>복사해 올 연도
            <select name="from" defaultValue={latest ?? ''}>
              <option value="">복사 안 함 (빈 연도)</option>
              {years.map((y) => <option key={y.year} value={y.year}>{y.year}</option>)}
            </select>
          </label>
          <button className="btn primary" type="submit">만들기</button>
        </div>
      </form>
    </main>
  );
}
