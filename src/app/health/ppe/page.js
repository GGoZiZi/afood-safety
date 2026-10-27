import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PPE_MOVES, SOON_DAYS, listPpe, ppeReplaceDue } from '@/lib/health';
import { today } from '@/lib/tbm';
import HealthTabs from '@/components/HealthTabs';
import { addPpeMove, deletePpeMove, savePpeItem, setPpeActive } from '../actions';

function ItemFields({ i = {} }) {
  return (
    <div className="form-grid">
      <label><span>품목명 <b>*</b></span><input type="text" name="name" required defaultValue={i.name ?? ''} placeholder="예: 안전화 (250mm)" /></label>
      <label><span>종류</span><input type="text" name="kind" defaultValue={i.kind ?? ''} placeholder="안전화, 보안경, 방진마스크 …" list="ppe-kinds" /></label>
      <label><span>안전인증번호</span><input type="text" name="cert_no" defaultValue={i.cert_no ?? ''} /></label>
      <label><span>교체주기 (개월)</span><input type="number" name="replace_months" min={0} defaultValue={i.replace_months ?? ''} /></label>
      <label><span>최소 재고</span><input type="number" name="min_stock" min={0} defaultValue={i.min_stock ?? 0} /></label>
      <label><span>비고</span><input type="text" name="note" defaultValue={i.note ?? ''} /></label>
    </div>
  );
}

export default async function PpePage({ searchParams }) {
  const user = await requireUser();
  const admin = user.role === 'admin';
  const sp = await searchParams;
  const db = getDb();
  const items = listPpe();
  const low = items.filter((i) => i.min_stock && i.stock < i.min_stock);
  const due = ppeReplaceDue();
  const moves = db
    .prepare(`SELECT m.*, i.name AS item FROM ppe_moves m JOIN ppe_items i ON i.id = m.item_id
      ${admin ? '' : 'WHERE m.dept = ? OR m.created_by = ?'} ORDER BY m.date DESC, m.id DESC LIMIT 200`)
    .all(...(admin ? [] : [user.dept, user.name]));
  const names = db.prepare(`SELECT name, dept1 AS dept FROM employees WHERE active = 1 UNION SELECT name, dept FROM health_people WHERE active = 1 ORDER BY name`).all();

  return (
    <main>
      <h1>보건관리</h1>
      <HealthTabs admin={admin} />
      <p className="sub">보호구 품목마다 입고·지급을 적으면 재고가 계산됩니다. 교체주기가 있는 품목은 마지막 지급일부터 {SOON_DAYS}일 안에 교체할 사람을 보여 줍니다.</p>
      {sp.saved && <div className="notice">품목을 저장했습니다.</div>}
      {sp.moved && <div className="notice">기록했습니다.</div>}

      <div className="stat-row">
        <div className="stat"><b>{items.length}</b><span>품목</span></div>
        <div className={`stat ${low.length ? 'warn' : ''}`}><b>{low.length}</b><span>재고 부족</span></div>
        <div className={`stat ${due.length ? 'warn' : ''}`}><b>{due.length}</b><span>교체 시기</span></div>
        <div className="stat"><b>{items.reduce((s, i) => s + i.issued_year, 0)}</b><span>올해 지급 수량</span></div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{admin ? '입고 · 지급 · 폐기' : '보호구 지급 기록'}</h2>
        <form action={addPpeMove}>
          <div className="form-grid">
            <label><span>품목</span>
              <select name="item_id" required>{items.map((i) => <option key={i.id} value={i.id}>{i.name} (재고 {i.stock})</option>)}</select>
            </label>
            <label><span>구분</span>
              <select name="kind" defaultValue="지급">{(admin ? PPE_MOVES : ['지급']).map((k) => <option key={k}>{k}</option>)}</select>
            </label>
            <label><span>날짜</span><input type="date" name="date" defaultValue={today()} /></label>
            <label><span>수량</span><input type="number" name="qty" min={1} defaultValue={1} required /></label>
            <label><span>받은 사람 (지급)</span><input type="text" name="person" list="ppe-people" /></label>
            <label><span>부서</span><input type="text" name="dept" defaultValue={admin ? '' : user.dept ?? ''} /></label>
            <label className="span2"><span>비고</span><input type="text" name="note" placeholder="예: 파손 교체, 신규 입사" /></label>
          </div>
          <datalist id="ppe-people">{names.map((n) => <option key={`${n.name}${n.dept}`} value={n.name}>{n.dept}</option>)}</datalist>
          <div className="form-actions"><button className="btn primary" type="submit" disabled={!items.length}>기록</button></div>
        </form>
        {!items.length && <p className="sub">먼저 {admin ? '아래에서' : '안전보건 담당자가'} 보호구 품목을 등록해야 합니다.</p>}
      </div>

      <h2>품목별 재고</h2>
      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 720 }}>
          <thead><tr><th>종류</th><th>품목</th><th>안전인증번호</th><th className="num">재고</th><th className="num">최소</th><th className="num">올해 지급</th><th>교체주기</th>{admin && <th></th>}</tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.kind}</td><td><b>{i.name}</b>{i.note ? <div className="sub">{i.note}</div> : null}</td><td>{i.cert_no}</td>
                <td className="num">{i.min_stock && i.stock < i.min_stock ? <span className="chip hidden">{i.stock}</span> : i.stock}</td>
                <td className="num">{i.min_stock || ''}</td><td className="num">{i.issued_year || ''}</td>
                <td>{i.replace_months ? `${i.replace_months}개월` : ''}</td>
                {admin && (
                  <td className="nowrap">
                    <details>
                      <summary className="btn small">고치기</summary>
                      <form action={savePpeItem} className="card" style={{ minWidth: 300 }}>
                        <input type="hidden" name="id" value={i.id} />
                        <ItemFields i={i} />
                        <div className="form-actions"><button className="btn primary small" type="submit">저장</button></div>
                      </form>
                      <form action={setPpeActive}><input type="hidden" name="id" value={i.id} /><button className="btn small danger" type="submit">목록에서 빼기</button></form>
                    </details>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={admin ? 8 : 7}>등록한 보호구가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      {due.length > 0 && (
        <>
          <h2>교체 시기</h2>
          <div className="table-wrap">
            <table className="sheet" style={{ minWidth: 520 }}>
              <thead><tr><th>교체일</th><th>품목</th><th>받은 사람</th><th>부서</th><th>마지막 지급</th></tr></thead>
              <tbody>
                {due.map((d) => (
                  <tr key={`${d.item}${d.person}`}>
                    <td className="nowrap">{d.due < today() ? <span className="chip hidden">{d.due}</span> : <span className="chip edit">{d.due}</span>}</td>
                    <td>{d.item}</td><td>{d.person}</td><td>{d.dept}</td><td className="nowrap">{d.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>기록</h2>
      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 720 }}>
          <thead><tr><th>날짜</th><th>구분</th><th>품목</th><th className="num">수량</th><th>받은 사람</th><th>부서</th><th>비고</th><th>적은 사람</th>{admin && <th></th>}</tr></thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id}>
                <td className="nowrap">{m.date}</td>
                <td><span className={`chip ${m.kind === '입고' ? 'ok' : m.kind === '폐기' ? 'old' : 'new'}`}>{m.kind}</span></td>
                <td>{m.item}</td><td className="num">{m.qty}</td><td>{m.person}</td><td>{m.dept}</td><td>{m.note}</td><td>{m.created_by}</td>
                {admin && <td><form action={deletePpeMove}><input type="hidden" name="id" value={m.id} /><button className="btn small danger" type="submit">지우기</button></form></td>}
              </tr>
            ))}
            {moves.length === 0 && <tr><td colSpan={admin ? 9 : 8}>기록이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      {admin && (
        <>
          <h2>보호구 품목 추가</h2>
          <form action={savePpeItem} className="card">
            <ItemFields />
            <datalist id="ppe-kinds">{['안전화', '안전모', '보안경', '방진마스크', '방독마스크', '귀마개', '내절단 장갑', '방열 장갑', '안전대', '앞치마'].map((k) => <option key={k} value={k} />)}</datalist>
            <div className="form-actions"><button className="btn primary" type="submit">추가</button></div>
          </form>
        </>
      )}
    </main>
  );
}
