// 재해사례 입력 폼 (새로 만들기 / 고치기 공용, 서버 컴포넌트)
export default function CaseForm({ action, c = {}, depts, submitLabel }) {
  const chosen = new Set((c.depts ?? '전체').split(','));
  return (
    <form action={action} className="card">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <div className="form-grid">
        <label><span>분류</span>
          <input type="text" name="category" list="case-cats" defaultValue={c.category ?? ''} placeholder="식품업계 / 지게차 / 화재 …" />
          <datalist id="case-cats">
            {['식품업계', '지게차', '컨베이어', '혼합기', '절단기', '화재', '물류', '실험실', '설비'].map((v) => <option key={v} value={v} />)}
          </datalist>
        </label>
        <label><span>발생일</span><input type="date" name="occurred_on" defaultValue={c.occurred_on ?? ''} /></label>
        <label><span>TBM 공유 시작일</span><input type="date" name="share_from" defaultValue={c.share_from ?? ''} /></label>
        <label><span>공유 일수</span><input type="number" name="share_days" min="1" max="60" defaultValue={c.share_days ?? 7} /></label>
        <label className="span4"><span>제목 <b>*</b> (TBM 사고사례 공유 칸에 들어가는 한 줄)</span>
          <textarea name="title" required defaultValue={c.title ?? ''} style={{ minHeight: 60 }} />
        </label>
        <label className="span2"><span>사고 개요</span><textarea name="summary" defaultValue={c.summary ?? ''} style={{ minHeight: 100 }} /></label>
        <label className="span2"><span>원인</span><textarea name="cause" defaultValue={c.cause ?? ''} style={{ minHeight: 100 }} /></label>
        <label className="span4"><span>예방대책 (우리 사업장 적용)</span><textarea name="prevention" defaultValue={c.prevention ?? ''} style={{ minHeight: 80 }} /></label>
        <label><span>출처</span><input type="text" name="source" defaultValue={c.source ?? ''} placeholder="안전보건공단, 고용노동부 …" /></label>
        <label className="span2"><span>링크</span><input type="url" name="url" defaultValue={c.url ?? ''} /></label>
        <label><span>상태</span>
          <select name="status" defaultValue={c.status ?? '채택'}>
            <option>채택</option><option>검토대기</option><option>제외</option>
          </select>
        </label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>공유할 TBM 부서</legend>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" name="depts" value="전체" defaultChecked={chosen.has('전체')} />전체
        </label>
        {depts.map((d) => (
          <label key={d} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" name="depts" value={d} defaultChecked={chosen.has(d)} />{d}
          </label>
        ))}
      </fieldset>
      <div className="form-actions"><button className="btn primary" type="submit">{submitLabel}</button></div>
    </form>
  );
}
