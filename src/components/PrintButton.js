'use client';

export default function PrintButton() {
  return (
    <button className="btn primary" type="button" onClick={() => window.print()}>
      인쇄 / PDF 저장
    </button>
  );
}
