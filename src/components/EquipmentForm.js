import { CERT_TYPES } from '@/lib/equipment';

// 설비 추가·수정 공용 폼 (서버 컴포넌트)
export default function EquipmentForm({ action, e = {}, processes, submitLabel }) {
  return (
    <form action={action} className="card">
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <div className="form-grid">
        <label><span>설비명 <b>*</b></span><input type="text" name="name" required defaultValue={e.name ?? ''} /></label>
        <label><span>장소</span><input type="text" name="location" defaultValue={e.location ?? ''} placeholder="커트밋, HMR …" /></label>
        <label><span>업체</span><input type="text" name="maker" defaultValue={e.maker ?? ''} /></label>
        <label><span>모델명</span><input type="text" name="model" defaultValue={e.model ?? ''} /></label>
        <label><span>인증 구분</span>
          <select name="cert_type" defaultValue={e.cert_type ?? '해당없음'}>{CERT_TYPES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label><span>인증·신고번호</span><input type="text" name="cert_no" defaultValue={e.cert_no ?? ''} /></label>
        <label><span>제조번호</span><input type="text" name="serial_no" defaultValue={e.serial_no ?? ''} /></label>
        <label><span>설치일</span><input type="date" name="install_date" defaultValue={e.install_date ?? ''} /></label>
        <label><span>점검주기 (개월)</span>
          <select name="cycle_months" defaultValue={e.cycle_months ?? ''}>
            <option value="">미설정</option>
            {[1, 2, 3, 6, 12, 24, 36].map((n) => <option key={n} value={n}>{n}개월{n === 12 ? ' (1년)' : n === 24 ? ' (2년)' : ''}</option>)}
          </select>
        </label>
        <label><span>담당자</span><input type="text" name="owner" defaultValue={e.owner ?? ''} /></label>
        <label className="span2"><span>공정</span>
          <select name="process_code" defaultValue={e.process_code ?? ''}>
            <option value="">(연결 안 함)</option>
            {processes.map((p) => <option key={p.code} value={p.code}>{p.code} · {p.dept} · {p.name}</option>)}
          </select>
        </label>
        <label className="span2"><span>설비 사진</span><input type="file" name="photo" accept="image/*" /></label>
        <label className="span2"><span>비고</span><input type="text" name="note" defaultValue={e.note ?? ''} /></label>
      </div>
      <div className="form-actions"><button className="btn primary" type="submit">{submitLabel}</button></div>
    </form>
  );
}
