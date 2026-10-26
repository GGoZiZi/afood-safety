import Link from 'next/link';
import { notFound } from 'next/navigation';
import RiskForm from '@/components/RiskForm';
import { improvementThreshold } from '@/lib/db';
import { FIELD_LABEL, getHistory, getPhotos, getRisk, listCodes, listProcesses } from '@/lib/risk';
import { isClosed } from '@/lib/year';
import { setDeleted, setVisibility, updateRisk } from '../actions';

export default async function RiskDetail({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const item = getRisk(Number(id));
  if (!item) notFound();
  const closed = isClosed(item.year);
  const photos = getPhotos(item.year, item.photo_link_id || item.item_code);
  const history = getHistory(item.id);

  return (
    <main>
      <p><Link href="/risk">← 대장으로</Link></p>
      <h1>{item.item_code} · {item.process_name}</h1>
      <p className="sub">
        {item.year}년 · {item.space} · 작업구분 {item.work_status} · {item.visibility}
        {item.deleted ? ' · 삭제된 항목' : ''} · 마지막 수정 {item.updated_at}
      </p>
      {sp.saved && <div className="notice">저장했습니다.</div>}
      {closed && <div className="notice">{item.year}년은 마감되어 읽기 전용입니다.</div>}

      {!closed && (
        <div className="form-actions" style={{ marginTop: 0, marginBottom: 16 }}>
          <form action={setVisibility}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="visibility" value={item.visibility === '공개' ? '미공개' : '공개'} />
            <button className="btn" type="submit">{item.visibility === '공개' ? '미공개로 바꾸기' : '공개로 바꾸기'}</button>
          </form>
          <form action={setDeleted}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="deleted" value={item.deleted ? '0' : '1'} />
            <button className={`btn ${item.deleted ? '' : 'danger'}`} type="submit">{item.deleted ? '복구' : '삭제 (숨김, 복구 가능)'}</button>
          </form>
        </div>
      )}

      <RiskForm
        action={updateRisk}
        item={item}
        year={item.year}
        processes={listProcesses(item.year)}
        causes={listCodes('cause')}
        likelihoods={listCodes('likelihood')}
        severities={listCodes('severity')}
        threshold={improvementThreshold()}
        readOnly={closed || !!item.deleted}
      />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>사진 ({photos.length})</h2>
        {photos.length === 0 ? (
          <p className="sub">연결된 사진이 없습니다. 사진 업로드는 순회점검 단계에서 추가됩니다.</p>
        ) : (
          <div className="photos">
            {photos.map((p) => (
              <figure key={p.id}>
                <a href={`/api/photo/${encodeURIComponent(p.filename)}`} target="_blank">
                  <img src={`/api/photo/${encodeURIComponent(p.filename)}`} alt={p.description || p.filename} loading="lazy" />
                </a>
                <figcaption>{p.kind ? `[${p.kind}] ` : ''}{p.description || p.filename}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>변경 이력</h2>
        {history.length === 0 ? (
          <p className="sub">엑셀에서 가져온 뒤 바뀐 내용이 없습니다.</p>
        ) : (
          <ul className="history">
            {history.map((h) => {
              const changes = h.changes ? JSON.parse(h.changes) : {};
              return (
                <li key={h.id}>
                  <b>{h.at}</b> {h.action}
                  {Object.entries(changes).map(([k, [a, b]]) => (
                    <div key={k} style={{ marginLeft: 16, color: 'var(--ink-soft)' }}>
                      {FIELD_LABEL[k] ?? k}: {a ?? '(빈칸)'} → {b ?? '(빈칸)'}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
