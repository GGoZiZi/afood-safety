// 건강진단 대상자 추가·수정 공용 폼 (서버 컴포넌트)
export default function HealthForm({ action, p = {}, submitLabel }) {
  const on = (v, d = 1) => (v ?? d) === 1;
  return (
    <form action={action} className="card">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="form-grid">
        <label><span>성명 <b>*</b></span><input type="text" name="name" required defaultValue={p.name ?? ''} /></label>
        <label><span>부서</span><input type="text" name="dept" defaultValue={p.dept ?? ''} /></label>
        <label><span>생년월일</span><input type="date" name="birth" defaultValue={p.birth ?? ''} /></label>
        <label><span>성별</span><select name="sex" defaultValue={p.sex ?? ''}><option value="">-</option><option>남</option><option>여</option></select></label>
        <label><span>입사일</span><input type="date" name="hire_date" defaultValue={p.hire_date ?? ''} /></label>
        <label><span>연락처</span><input type="text" name="phone" defaultValue={p.phone ?? ''} /></label>
        <div className="span2 checks">
          <label><input type="checkbox" name="general" defaultChecked={on(p.general)} /> 일반건강진단</label>
          <label>주기
            <select name="general_cycle" defaultValue={p.general_cycle ?? 12}><option value={12}>1년 (생산직 등)</option><option value={24}>2년 (사무직)</option></select>
          </label>
          <label><input type="checkbox" name="food_cert" defaultChecked={on(p.food_cert)} /> 보건증 (1년)</label>
          <label><input type="checkbox" name="night_work" defaultChecked={on(p.night_work, 0)} /> 야간작업</label>
        </div>
        <label className="span2"><span>특수건강진단 유해인자 (한 줄에 하나, 없으면 비움)</span>
          <textarea name="agents" rows={3} defaultValue={p.agents ?? ''} placeholder={'방사선 (수시출입자)\n곡분분진'} />
        </label>
        <label><span>특수건강진단 주기</span>
          <select name="special_cycle" defaultValue={p.special_cycle ?? 12}>
            <option value={6}>6개월</option><option value={12}>12개월</option><option value={24}>24개월 (광물성·목재 분진, 소음)</option>
          </select>
        </label>
        <label><span>비고</span><input type="text" name="note" defaultValue={p.note ?? ''} /></label>
      </div>
      <div className="form-actions"><button className="btn primary" type="submit">{submitLabel}</button></div>
    </form>
  );
}
