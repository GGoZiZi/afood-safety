import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { LANGS } from '@/lib/i18n';
import { WEEKDAY_LABEL, listTbmDepts, safetyRules, tbmTime } from '@/lib/tbm';
import { currentYear } from '@/lib/year';
import { addDept, saveDept, saveMember, saveRules, setProcessDept } from '../actions';

export default async function TbmSettings() {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/tbm');
  const year = await currentYear();
  const db = getDb();
  const depts = listTbmDepts();
  const members = db.prepare('SELECT * FROM tbm_members ORDER BY dept, active DESC, sort, id').all();
  const procs = db.prepare('SELECT id, code, name, sub_task, tbm_dept FROM processes WHERE year = ? ORDER BY seq, code').all(year);
  const unmapped = procs.filter((p) => !p.tbm_dept).length;

  return (
    <main>
      <p><Link href="/tbm">← TBM 일지</Link></p>
      <h1>TBM 설정</h1>
      <p className="sub">부서별 실시 요일, TBM 리더, 팀원(인쇄 언어), 안전보건 5계명, 공정과 TBM 부서 연결을 관리합니다.</p>

      <h2>부서</h2>
      {depts.map((d) => (
        <form key={d.code} action={saveDept} className="card">
          <input type="hidden" name="code" value={d.code} />
          <h3 style={{ marginTop: 0 }}>{d.code}</h3>
          <div className="form-grid">
            <label><span>TBM 장소</span><input type="text" name="place" defaultValue={d.place ?? ''} /></label>
            <label className="span3"><span>작업명</span><input type="text" name="work_name" defaultValue={d.work_name ?? ''} /></label>
            <label><span>리더 소속</span><input type="text" name="leader_affil" defaultValue={d.leader_affil ?? ''} /></label>
            <label><span>리더 직책</span><input type="text" name="leader_title" defaultValue={d.leader_title ?? ''} /></label>
            <label><span>리더 성명</span><input type="text" name="leader_name" defaultValue={d.leader_name ?? ''} /></label>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: '10px 0 0', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>실시 요일</legend>
            {[1, 2, 3, 4, 5, 6, 7].map((w) => (
              <label key={w} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="checkbox" name="weekdays" value={w} defaultChecked={d.weekdays.split(',').includes(String(w))} />{WEEKDAY_LABEL[w]}
              </label>
            ))}
            <button className="btn primary small" type="submit" style={{ marginLeft: 'auto' }}>저장</button>
          </fieldset>
        </form>
      ))}
      <form action={addDept} className="filters">
        <label>새 부서<input type="text" name="code" placeholder="예: 생산3팀" /></label>
        <button className="btn" type="submit">부서 추가</button>
      </form>

      <h2>팀원 (TBM 참석 대상)</h2>
      <p className="sub">여기서 바꾼 명단은 앞으로 새로 만들어지는 TBM부터 적용됩니다. 언어는 외국인 근로자 확인용입니다.</p>
      {depts.map((d) => {
        const list = members.filter((m) => m.dept === d.code);
        return (
          <div key={d.code} className="card">
            <h3 style={{ marginTop: 0 }}>{d.code} ({list.filter((m) => m.active).length}명)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {list.map((m) => (
                <form key={m.id} action={saveMember} style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: m.active ? 1 : 0.5 }}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="text" name="name" defaultValue={m.name} aria-label="이름" style={{ width: 90 }} />
                  <select name="lang" defaultValue={m.lang} aria-label="언어">
                    {LANGS.map(([k, v]) => <option key={k} value={k}>{v.split(' ')[0]}</option>)}
                  </select>
                  <select name="active" defaultValue={String(m.active)} aria-label="상태">
                    <option value="1">재직</option>
                    <option value="0">제외</option>
                  </select>
                  <button className="btn small" type="submit">저장</button>
                </form>
              ))}
            </div>
            <form action={saveMember} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
              <input type="hidden" name="dept" value={d.code} />
              <input type="text" name="name" placeholder="새 팀원 이름" aria-label="새 팀원 이름" />
              <select name="lang" defaultValue="ko" aria-label="언어">
                {LANGS.map(([k, v]) => <option key={k} value={k}>{v.split(' ')[0]}</option>)}
              </select>
              <button className="btn small" type="submit">추가</button>
            </form>
          </div>
        );
      })}

      <h2>안전보건 5계명 · TBM 시간</h2>
      <form action={saveRules} className="card">
        <div className="form-grid">
          <label><span>TBM 시간 (기본값)</span><input type="text" name="tbm_time" defaultValue={tbmTime()} /></label>
          <label className="span4"><span>5계명 (한 줄에 하나)</span>
            <textarea name="rules" defaultValue={safetyRules().join('\n')} style={{ minHeight: 120 }} />
          </label>
        </div>
        <p className="sub">기본 5계명을 그대로 쓰면 외국어 출력 때 번역문이 함께 나갑니다. 문구를 바꾸면 한국어로만 출력됩니다.</p>
        <div className="form-actions"><button className="btn primary" type="submit">저장</button></div>
      </form>

      <h2>공정 → TBM 부서 ({year}년{unmapped ? `, 미연결 ${unmapped}개` : ''})</h2>
      <p className="sub">연결된 부서의 TBM에 그 공정의 위험요인이 돌아가며 들어갑니다. 미연결 공정은 TBM에 나오지 않습니다.</p>
      <div className="table-wrap">
        <table className="sheet">
          <thead><tr><th>공정ID</th><th>공정명</th><th>세부작업</th><th>TBM 부서</th></tr></thead>
          <tbody>
            {procs.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td><td>{p.name}</td><td>{p.sub_task}</td>
                <td>
                  <form action={setProcessDept} style={{ display: 'flex', gap: 6 }}>
                    <input type="hidden" name="id" value={p.id} />
                    <select name="tbm_dept" defaultValue={p.tbm_dept ?? ''} aria-label={`${p.code} TBM 부서`}>
                      <option value="">(연결 안 함)</option>
                      {depts.map((d) => <option key={d.code}>{d.code}</option>)}
                    </select>
                    <button className="btn small" type="submit">저장</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
