import { fileUrl } from '@/lib/upload';
import { deleteDocument, uploadDocument } from '@/app/documents/actions';

// 첨부 문서 목록 + 올리기 (서버 컴포넌트). versioned: 판·시행일 칸을 보여줄지
export default function DocList({ kind, ownerId, docs, back, canUpload = true, canDelete, versioned, titleHint }) {
  return (
    <div>
      {docs.length === 0 ? <p className="sub">첨부한 문서가 없습니다.</p> : (
        <ul className="history" style={{ paddingLeft: 18 }}>
          {docs.map((d, i) => (
            <li key={d.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <a href={fileUrl(d.filename)} target="_blank"><b>{d.title}</b></a>
              {versioned && i === 0 && <span className="chip ok">현행</span>}
              <span style={{ color: 'var(--ink-soft)' }}>
                {[d.version, d.effective_on && `${d.effective_on} 시행`, `${d.uploaded_at.slice(0, 10)} ${d.uploaded_by ?? ''}`, d.note].filter(Boolean).join(' · ')}
              </span>
              {canDelete && (
                <form action={deleteDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="back" value={back} />
                  <button className="btn small danger" type="submit">지우기</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <form action={uploadDocument} className="filters" style={{ marginTop: 8 }}>
          <input type="hidden" name="owner_kind" value={kind} />
          {ownerId && <input type="hidden" name="owner_id" value={ownerId} />}
          <input type="hidden" name="back" value={back} />
          <label>파일<input type="file" name="file" required accept=".pdf,image/*,.xlsx,.xls,.docx,.doc,.hwp,.hwpx" /></label>
          <label>제목<input type="text" name="title" placeholder={titleHint ?? '비우면 파일 이름'} /></label>
          {versioned && <label>판<input type="text" name="version" placeholder="예: 제3판" style={{ width: 90 }} /></label>}
          {versioned && <label>시행일<input type="date" name="effective_on" /></label>}
          <button className="btn" type="submit">올리기</button>
        </form>
      )}
    </div>
  );
}
