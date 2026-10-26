import Link from 'next/link';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { today } from '@/lib/tbm';
import { currentYear } from '@/lib/year';
import { createPatrol } from './actions';

export default async function PatrolList() {
  const user = await requireUser();
  const year = await currentYear();
  const rows = getDb()
    .prepare(`SELECT p.*, COUNT(f.id) AS n,
        SUM(f.decision = '등록') AS reg, SUM(f.decision = '미등록') AS unreg, SUM(f.decision = '미정') AS open,
        SUM(f.done_date IS NOT NULL) AS done
      FROM patrols p LEFT JOIN patrol_findings f ON f.patrol_id = p.id
      WHERE p.year = ? GROUP BY p.id ORDER BY p.date DESC, p.id DESC`)
    .all(year);

  return (
    <main>
      <h1>순회점검</h1>
      <p className="sub">현장 사진을 올리고 사진마다 지적 내용을 적은 뒤, 위험성평가에 신규 위험요인으로 등록할지 정합니다. 등록하지 않은 지적사항도 개선조치 목록에서 관리됩니다.</p>

      <form action={createPatrol} className="card">
        <h2 style={{ marginTop: 0 }}>새 순회점검</h2>
        <div className="form-grid">
          <label><span>점검일</span><input type="date" name="date" required defaultValue={today()} /></label>
          <label><span>점검 구역</span><input type="text" name="area" placeholder="예: 생산1팀 가공실" /></label>
          <label><span>점검자</span><input type="text" name="inspector" defaultValue={user.name} /></label>
          <label><span>현장 사진 (여러 장 선택 가능)</span><input type="file" name="photos" accept="image/*" multiple /></label>
          <label className="span4"><span>메모</span><input type="text" name="note" /></label>
        </div>
        <div className="form-actions"><button className="btn primary" type="submit">올리고 기록하기</button></div>
      </form>

      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 760 }}>
          <thead><tr><th>점검일</th><th>구역</th><th>점검자</th><th className="num">사진·지적</th><th className="num">위험성평가 등록</th><th className="num">조치만</th><th className="num">결정 전</th><th className="num">조치완료</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap"><Link href={`/patrol/${r.id}`}>{r.date}</Link></td>
                <td><Link href={`/patrol/${r.id}`}>{r.area ?? '(구역 미입력)'}</Link></td>
                <td>{r.inspector}</td>
                <td className="num">{r.n}</td>
                <td className="num">{r.reg || ''}</td>
                <td className="num">{r.unreg || ''}</td>
                <td className="num">{r.open ? <span className="chip edit">{r.open}</span> : ''}</td>
                <td className="num">{r.done || ''}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8}>{year}년 순회점검 기록이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
