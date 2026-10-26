'use client';

import { useState } from 'react';

// 위험요인 추가/수정 폼. 가능성 x 중대성은 입력하는 즉시 계산해서 보여준다.
export default function RiskForm({ action, item, year, processes, causes, likelihoods, severities, threshold, readOnly }) {
  const isNew = !item?.id;
  const [L, setL] = useState(item?.likelihood ?? '');
  const [S, setS] = useState(item?.severity ?? '');
  const [pL, setPL] = useState(item?.post_likelihood ?? '');
  const [pS, setPS] = useState(item?.post_severity ?? '');
  const [cause, setCause] = useState(item?.cause ?? '');
  const risk = L && S ? L * S : null;
  const postRisk = pL && pS ? pL * pS : null;
  const categoryOf = (c) => causes.find((x) => x.code === c)?.label ?? item?.category ?? '';
  const needsAction = risk && risk >= threshold;

  return (
    <form action={action}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <input type="hidden" name="year" value={year} />
        {!isNew && <input type="hidden" name="id" value={item.id} />}

        <div className="card">
          <h2 style={{ marginTop: 0 }}>공정 · 유해위험요인</h2>
          <div className="form-grid">
            {isNew ? (
              <label className="span2"><span>공정 <b>*</b></span>
                <select name="process_code" required defaultValue={item?.process_code ?? ''}>
                  <option value="" disabled>공정을 고르세요</option>
                  {processes.map((p) => <option key={p.code} value={p.code}>{p.code} · {p.dept} · {p.name}</option>)}
                </select>
              </label>
            ) : (
              <label><span>항목ID</span><input type="text" value={item.item_code} readOnly /></label>
            )}
            {!isNew && <label><span>공정명</span><input type="text" name="process_name" defaultValue={item.process_name ?? ''} /></label>}
            <label><span>세부작업명</span><input type="text" name="sub_task" defaultValue={item?.sub_task ?? ''} placeholder={isNew ? '비우면 공정의 세부작업명' : ''} /></label>
            <label><span>공간명</span><input type="text" name="space" defaultValue={item?.space ?? ''} placeholder={isNew ? '비우면 공정의 공간명' : ''} /></label>
            <label className="span2"><span>원인 (분류는 자동)</span>
              <select name="cause" value={cause} onChange={(e) => setCause(e.target.value)}>
                <option value="">선택</option>
                {item?.cause && !causes.some((c) => c.code === item.cause) && <option value={item.cause}>{item.cause}</option>}
                {causes.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </label>
            <label className="span2"><span>분류</span><input type="text" name="category" value={categoryOf(cause)} readOnly /></label>
            <label className="span4"><span>유해위험요인 <b>*</b></span><textarea name="hazard" required defaultValue={item?.hazard ?? ''} /></label>
            <label className="span2"><span>관련근거</span><input type="text" name="legal_basis" defaultValue={item?.legal_basis ?? ''} placeholder="안전보건규칙 제00조" /></label>
            <label className="span2"><span>위평전 사전조치담당</span><input type="text" name="pre_owner" defaultValue={item?.pre_owner ?? ''} /></label>
            <label className="span4"><span>현재 안전보건조치</span><textarea name="current_measure" defaultValue={item?.current_measure ?? ''} /></label>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>위험성 결정</h2>
          <div className="form-grid">
            <label><span>가능성 (1~5)</span>
              <select name="likelihood" value={L} onChange={(e) => setL(Number(e.target.value) || '')}>
                <option value="">-</option>
                {likelihoods.map((c) => <option key={c.code} value={c.code}>{c.code} {c.label}</option>)}
              </select>
            </label>
            <label><span>중대성 (1~4)</span>
              <select name="severity" value={S} onChange={(e) => setS(Number(e.target.value) || '')}>
                <option value="">-</option>
                {severities.map((c) => <option key={c.code} value={c.code}>{c.code} {c.label}</option>)}
              </select>
            </label>
            <div className="score-box">위험성 <output className={needsAction ? 'risk-high' : ''}>{risk ?? '-'}</output>
              {needsAction && <span>개선대상 ({threshold}점 이상)</span>}
            </div>
            <label><span>공개 여부</span>
              <select name="visibility" defaultValue={item?.visibility ?? '공개'}>
                <option>공개</option>
                <option>미공개</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>감소대책 · 개선조치</h2>
          <div className="form-grid">
            <label className="span4"><span>감소대책</span><textarea name="reduction" defaultValue={item?.reduction ?? ''} /></label>
            <label><span>개선 후 가능성</span>
              <select name="post_likelihood" value={pL} onChange={(e) => setPL(Number(e.target.value) || '')}>
                <option value="">-</option>
                {likelihoods.map((c) => <option key={c.code} value={c.code}>{c.code} {c.label}</option>)}
              </select>
            </label>
            <label><span>개선 후 중대성</span>
              <select name="post_severity" value={pS} onChange={(e) => setPS(Number(e.target.value) || '')}>
                <option value="">-</option>
                {severities.map((c) => <option key={c.code} value={c.code}>{c.code} {c.label}</option>)}
              </select>
            </label>
            <div className="score-box">개선 후 위험성 <output>{postRisk ?? '-'}</output></div>
            <span />
            <label><span>조치담당자</span><input type="text" name="action_owner" defaultValue={item?.action_owner ?? ''} /></label>
            <label><span>조치예정일</span><input type="date" name="due_date" defaultValue={item?.due_date ?? ''} /></label>
            <label><span>완료일</span><input type="date" name="done_date" defaultValue={item?.done_date ?? ''} /></label>
            <label><span>기존 조치번호</span><input type="text" name="prev_action_no" defaultValue={item?.prev_action_no ?? ''} /></label>
            <label className="span2"><span>비고</span><input type="text" name="note" defaultValue={item?.note ?? ''} /></label>
            <label><span>비고1</span><input type="text" name="note2" defaultValue={item?.note2 ?? ''} /></label>
            <label><span>사진연결ID</span><input type="text" name="photo_link_id" defaultValue={item?.photo_link_id ?? ''} placeholder="비우면 항목ID" /></label>
          </div>
        </div>

        {!readOnly && (
          <div className="form-actions">
            <button className="btn primary" type="submit">{isNew ? '추가' : '저장'}</button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
