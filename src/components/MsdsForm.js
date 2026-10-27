export default function MsdsForm({ action, m = {}, submitLabel }) {
  return (
    <form action={action} className="card">
      {m.id && <input type="hidden" name="id" value={m.id} />}
      <div className="form-grid">
        <label><span>No</span><input type="number" name="no" defaultValue={m.no ?? ''} /></label>
        <label className="span2"><span>화학물질명 <b>*</b></span><input type="text" name="name" required defaultValue={m.name ?? ''} /></label>
        <label><span>MSDS번호</span><input type="text" name="msds_no" defaultValue={m.msds_no ?? ''} /></label>
        <label className="span2"><span>사용목적</span><input type="text" name="purpose" defaultValue={m.purpose ?? ''} /></label>
        <label><span>제조사·공급사</span><input type="text" name="supplier" defaultValue={m.supplier ?? ''} /></label>
        <label><span>순수물질 / 혼합물</span>
          <select name="mixture" defaultValue={m.mixture ?? ''}><option value="">-</option><option>순수물질</option><option>혼합물</option></select>
        </label>
        <label><span>사용공정(구역)</span><input type="text" name="place" defaultValue={m.place ?? ''} /></label>
        <label><span>월 사용량</span><input type="text" name="monthly_use" defaultValue={m.monthly_use ?? ''} /></label>
        <label><span>MSDS 개정일</span><input type="date" name="revised_on" defaultValue={m.revised_on ?? ''} /></label>
        <label><span>현장 게시</span>
          <select name="posted" defaultValue={String(m.posted ?? 0)}><option value="1">게시함</option><option value="0">미게시</option></select>
        </label>
        <label className="span4"><span>구성성분 (한 줄에 "성분명 | CAS번호 | 함유량")</span>
          <textarea name="components" defaultValue={m.components ?? ''} style={{ minHeight: 90 }} />
        </label>
        <label className="span4"><span>작업환경측정 특이사항</span><input type="text" name="measure_note" defaultValue={m.measure_note ?? ''} placeholder="측정 대상이면 '해당'" /></label>
      </div>
      <div className="form-actions"><button className="btn primary" type="submit">{submitLabel}</button></div>
    </form>
  );
}
