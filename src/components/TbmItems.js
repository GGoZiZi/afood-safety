'use client';

import { useState } from 'react';

// TBM 잠재위험요인 4칸. "다른 위험요인으로 교체"를 고르면 문구가 대장 내용으로 바뀐다.
export default function TbmItems({ items, options }) {
  const bySlot = Object.fromEntries(items.map((i) => [i.slot, i]));
  const byId = Object.fromEntries(options.map((o) => [o.id, o]));
  const [rows, setRows] = useState(
    [1, 2, 3, 4].map((slot) => ({
      slot,
      risk: bySlot[slot]?.risk_item_id ?? '',
      hazard: bySlot[slot]?.hazard ?? '',
      measure: bySlot[slot]?.measure ?? '',
    })),
  );
  const update = (slot, patch) => setRows((rs) => rs.map((r) => (r.slot === slot ? { ...r, ...patch } : r)));

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>잠재위험요인 · 대책</h2>
      <p className="sub">위험성평가 대장에서 공정별로 돌아가며 4건이 자동으로 들어옵니다. 바꾸려면 교체를 고르거나 직접 고치세요.</p>
      {rows.map((r) => (
        <div key={r.slot} style={{ borderTop: '1px solid var(--line-soft)', padding: '10px 0' }}>
          <input type="hidden" name={`risk_${r.slot}`} value={r.risk} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <strong>{r.slot}.</strong>
            <select
              aria-label={`${r.slot}번 위험요인 교체`}
              value={r.risk}
              onChange={(e) => {
                const o = byId[e.target.value];
                if (o) update(r.slot, { risk: o.id, hazard: o.hazard, measure: o.measure ?? '' });
                else update(r.slot, { risk: '' });
              }}
              style={{ flex: '1 1 260px', minWidth: 0, maxWidth: 640 }}
            >
              <option value="">직접 입력 (대장과 연결 안 함)</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.item_code} [{o.risk ?? '-'}점] {o.hazard.slice(0, 60)}</option>
              ))}
            </select>
          </div>
          <div className="form-grid">
            <label className="span2"><span>잠재위험요인</span><textarea name={`hazard_${r.slot}`} value={r.hazard} onChange={(e) => update(r.slot, { hazard: e.target.value })} /></label>
            <label className="span2"><span>대책</span><textarea name={`measure_${r.slot}`} value={r.measure} onChange={(e) => update(r.slot, { measure: e.target.value })} /></label>
          </div>
        </div>
      ))}
    </div>
  );
}
