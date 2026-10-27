import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { budgetSummary, ensureBudgetDefaults, listRules, won } from '@/lib/budget';
import { currentYear } from '@/lib/year';
import { addEntry, confirmAll, deleteEntry, deleteRule, importBudget, reclassify, savePlans, saveRule, setEntry, setVat } from './actions';

const STATUS_CHIP = { 자동: 'new', 검토: 'edit', 확인: 'ok', 제외: 'hidden' };
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');

export default async function BudgetPage({ searchParams }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/tbm');
  const sp = await searchParams;
  const year = await currentYear();
  ensureBudgetDefaults(year);
  const { rows, total, review, heads, vat } = budgetSummary(year);
  const cats = rows.map((r) => r.category);
  const where = ['year = ?'];
  const args = [year];
  const status = sp.status ?? (review.n ? '검토' : '');
  if (status) { where.push('status = ?'); args.push(status); }
  if (sp.cat) { where.push('category = ?'); args.push(sp.cat); }
  if (sp.q) { where.push('(memo LIKE ? OR vendor LIKE ?)'); args.push(`%${sp.q}%`, `%${sp.q}%`); }
  const entries = getDb().prepare(`SELECT * FROM budget_entries WHERE ${where.join(' AND ')} ORDER BY date DESC, id DESC LIMIT 500`).all(...args);
  const counts = Object.fromEntries(getDb().prepare('SELECT status, COUNT(*) AS n FROM budget_entries WHERE year = ? GROUP BY status').all(year).map((r) => [r.status, r.n]));
  const imp = sp.imported?.split('-');
  const perHead = heads ? Math.round(total.planned / heads) : 0;
  const link = (patch) => `/budget?${new URLSearchParams({ ...(sp.cat && { cat: sp.cat }), ...patch })}`;

  return (
    <main>
      <h1>{year}년 위험성평가 예산편성 및 집행</h1>
      <p className="sub">ERP 계정내역 엑셀을 올리면 비고 문구로 구분을 자동으로 나눕니다. 수선비 계정인데 낱말이 없는 건은 "검토"로 올라오니 안전 관련인지 확인해 주세요. 집행액은 자동·확인 건만 셉니다.</p>
      {imp && <div className="notice">가져왔습니다: 편성 {imp[0]}개 구분, 새 집행 {imp[1]}건, 고침 {imp[2]}건 (검토 필요 {imp[3]}건){Number(imp[4]) ? `, 다른 연도 ${imp[4]}건은 건너뜀` : ''}</div>}

      <div className="stat-row">
        <div className="stat"><b>{won(total.planned)}</b><span>편성액 (원)</span></div>
        <div className="stat"><b>{won(total.spent)}</b><span>집행액 ({vat ? '부가세 포함' : '공급가'})</span></div>
        <div className={`stat ${total.spent > total.planned && total.planned ? 'warn' : ''}`}><b>{pct(total.spent, total.planned)}</b><span>집행률</span></div>
        <div className={`stat ${heads && perHead < 20000 ? 'warn' : ''}`}><b>{won(perHead)}</b><span>1인당 편성 ({heads}명, 기준 2만원)</span></div>
        <Link className={`stat ${review.n ? 'warn' : ''}`} href={link({ status: '검토' })}><b>{review.n ?? 0}</b><span>검토 필요</span></Link>
      </div>

      <form action={savePlans}>
        <input type="hidden" name="year" value={year} />
        <div className="table-wrap">
          <table className="sheet" style={{ minWidth: 960 }}>
            <thead><tr><th>구분</th><th className="num">{year}년 편성액</th><th className="hazard">편성내역</th><th className="num">집행액</th><th className="num">집행률</th><th className="num">잔액</th><th className="num">건수</th></tr></thead>
            <tbody>
              <tr style={{ fontWeight: 700 }}><td>합계</td><td className="num">{won(total.planned)}</td><td /><td className="num">{won(total.spent)}</td><td className="num">{pct(total.spent, total.planned)}</td><td className="num">{won(total.planned - total.spent)}</td><td /></tr>
              {rows.map((r) => (
                <tr key={r.category}>
                  <td><input type="hidden" name="category" value={r.category} /><Link href={link({ cat: r.category, status: '' })}>{r.category}</Link></td>
                  <td className="num"><input type="text" inputMode="numeric" name={`planned:${r.category}`} defaultValue={r.planned != null ? won(r.planned) : ''} style={{ width: 120, textAlign: 'right' }} aria-label={`${r.category} 편성액`} /></td>
                  <td className="hazard"><textarea name={`detail:${r.category}`} defaultValue={r.detail ?? ''} rows={Math.max(1, (r.detail ?? '').split('\n').length)} style={{ width: '100%', fontSize: 12 }} aria-label={`${r.category} 편성내역`} /></td>
                  <td className="num">{won(r.spent)}</td>
                  <td className={`num ${r.planned && r.spent > r.planned ? 'risk-high' : ''}`}>{pct(r.spent, r.planned)}</td>
                  <td className="num">{r.planned != null ? won(r.planned - r.spent) : ''}</td>
                  <td className="num">{r.count || ''}</td>
                </tr>
              ))}
              <tr>
                <td><input type="text" name="new_category" placeholder="+ 새 구분" aria-label="새 구분" style={{ width: '100%' }} /></td>
                <td className="num"><input type="text" inputMode="numeric" name="new_planned" placeholder="편성액" aria-label="새 구분 편성액" style={{ width: 120 }} /></td>
                <td colSpan={5} />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="form-actions">
          <a className="btn" href={`/api/export/budget?year=${year}`}>엑셀로 내보내기</a>
          <button className="btn primary" type="submit">편성 저장</button>
        </div>
      </form>

      <h2>집행 내역</h2>
      <form className="filters" method="get">
        <label>상태
          <select name="status" defaultValue={status}>
            <option value="">전체</option>{['검토', '자동', '확인', '제외'].map((s) => <option key={s} value={s}>{s} ({counts[s] ?? 0})</option>)}
          </select>
        </label>
        <label>구분<select name="cat" defaultValue={sp.cat ?? ''}><option value="">전체</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>검색<input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="비고, 거래처" /></label>
        <button className="btn" type="submit">보기</button>
      </form>
      {counts.자동 > 0 && (
        <form action={confirmAll} style={{ marginBottom: 8 }}>
          <input type="hidden" name="year" value={year} />
          {sp.cat && <input type="hidden" name="category" value={sp.cat} />}
          <button className="btn" type="submit">자동 분류 {sp.cat ? '(이 구분) ' : ''}{counts.자동}건 모두 확인</button>
        </form>
      )}
      <div className="table-wrap">
        <table className="sheet" style={{ minWidth: 1100 }}>
          <thead><tr><th>회계일</th><th className="hazard">비고</th><th>거래처</th><th className="num">금액</th><th className="num">부가세</th><th>분류 근거</th><th>구분 · 상태</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{e.date}</td>
                <td className="hazard">{e.memo}<div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{[e.dept, e.accounts, e.voucher].filter(Boolean).join(' · ')}</div></td>
                <td>{e.vendor}</td>
                <td className="num">{won(e.amount)}</td>
                <td className="num">{e.vat ? won(e.vat) : ''}</td>
                <td style={{ fontSize: 12 }}>{e.source === '직접' ? '직접 입력' : e.rule}</td>
                <td>
                  <form action={setEntry.bind(null, '확인')} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input type="hidden" name="id" value={e.id} />
                    <span className={`chip ${STATUS_CHIP[e.status]}`}>{e.status}</span>
                    <select name="category" defaultValue={e.category ?? ''} aria-label="구분" style={{ maxWidth: 220 }}>
                      <option value="">(없음)</option>{cats.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button className="btn small" type="submit">확인</button>
                    <button className="btn small" type="submit" formAction={setEntry.bind(null, '제외')}>제외</button>
                    {e.source === '직접' && <button className="btn small danger" type="submit" formAction={deleteEntry}>지우기</button>}
                  </form>
                </td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={7}>해당하는 집행 내역이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      <form action={addEntry} className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>직접 입력 (ERP에 없는 지출)</h2>
        <div className="form-grid">
          <label><span>날짜</span><input type="date" name="date" required /></label>
          <label className="span2"><span>내용</span><input type="text" name="memo" required /></label>
          <label><span>금액 (원)</span><input type="text" inputMode="numeric" name="amount" required /></label>
          <label className="span2"><span>구분</span><select name="category" defaultValue={cats[0]}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="span2"><span>거래처</span><input type="text" name="vendor" /></label>
        </div>
        <div className="form-actions"><button className="btn" type="submit">추가</button></div>
      </form>

      <form action={importBudget} className="card">
        <h2 style={{ marginTop: 0 }}>ERP 계정내역 엑셀 가져오기</h2>
        <p className="sub">ERP에서 내려받은 계정내역(회계일·계정명·전표번호·비고·차변·대변 칸) 엑셀을 올리세요. 기존 "예산편성 및 집행" 엑셀을 올리면 편성액과 편성내역도 함께 들어갑니다. 같은 전표를 다시 올려도 두 번 세지 않고, 확인·제외한 건은 그대로 둡니다.</p>
        <input type="hidden" name="year" value={year} />
        <div className="filters" style={{ border: 0, padding: 0 }}>
          <input type="file" name="file" accept=".xlsx,.xls" required aria-label="엑셀 파일" />
          <button className="btn primary" type="submit">가져오기</button>
        </div>
      </form>

      <details className="card">
        <summary>분류 낱말 ({listRules().length}개) · 부가세</summary>
        <p className="sub" style={{ marginTop: 8 }}>비고에 낱말이 들어 있으면 그 구분으로 나눕니다. 순서 숫자가 작은 낱말이 먼저 적용됩니다. 구분을 "제외"로 하면 그 낱말이 든 건은 집행에서 뺍니다.</p>
        <form action={saveRule} className="filters">
          <label>낱말<input type="text" name="keyword" required /></label>
          <label>구분<select name="category">{[...cats, '제외'].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>순서<input type="number" name="priority" defaultValue={5} style={{ width: 70 }} /></label>
          <button className="btn" type="submit">추가·변경</button>
        </form>
        <form action={reclassify} style={{ margin: '8px 0' }}>
          <input type="hidden" name="year" value={year} />
          <button className="btn small" type="submit">낱말을 바꿨으면: 확인·제외 안 한 건 다시 분류</button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {listRules().map((r) => (
            <form key={r.id} action={deleteRule} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', border: '1px solid var(--line-soft)', borderRadius: 6, padding: '2px 6px', fontSize: 12 }}>
              <input type="hidden" name="id" value={r.id} />
              <b>{r.keyword}</b> → {r.category.replace(/ \(.*\)$/, '')} <span style={{ color: 'var(--ink-soft)' }}>{r.priority}</span>
              <button type="submit" className="btn small" aria-label={`${r.keyword} 지우기`} style={{ minHeight: 20, padding: '0 6px' }}>×</button>
            </form>
          ))}
        </div>
        <form action={setVat} style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>집행액에 부가세
            <select name="vat" defaultValue={vat ? '1' : '0'}><option value="1">포함 (기존 엑셀과 같음)</option><option value="0">빼기 (공급가만)</option></select>
          </label>
          <button className="btn small" type="submit">저장</button>
        </form>
      </details>
    </main>
  );
}
