'use client';

import { useEffect, useState } from 'react';

// 화면: 한 장씩 넘기기(←/→ 키, 화면 터치). 인쇄: 모든 카드를 A4 가로 한 장씩.
export default function FlashCards({ cards, source }) {
  const [i, setI] = useState(0);
  const go = (d) => setI((v) => Math.max(0, Math.min(cards.length - 1, v + d)));
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="fc-wrap">
      <style>{`
        .fc-wrap { padding: 0 16px 24px; }
        .fc-card { background: #1f2328; color: #fff; border-radius: 14px; min-height: 60vh; padding: 36px 40px; display: flex; flex-direction: column; gap: 18px; }
        .fc-kicker { color: #f5a524; font-weight: 700; font-size: 18px; }
        .fc-title { font-size: 30px; font-weight: 800; margin: 0; }
        .fc-body { font-size: 24px; line-height: 1.6; white-space: pre-line; word-break: keep-all; }
        .fc-body.big { font-size: 30px; font-weight: 700; }
        .fc-foot { margin-top: auto; color: #9aa4ae; font-size: 14px; display: flex; justify-content: space-between; }
        .fc-nav { display: flex; gap: 8px; justify-content: center; margin-top: 12px; align-items: center; }
        .fc-print { display: none; }
        @media (max-width: 700px) { .fc-card { padding: 22px; } .fc-title { font-size: 22px; } .fc-body { font-size: 18px; } .fc-body.big { font-size: 21px; } }
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          .fc-screen { display: none; }
          .fc-print { display: block; }
          .fc-print .fc-card { min-height: 170mm; break-after: page; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .fc-print .fc-card:last-child { break-after: auto; }
        }
      `}</style>
      <div className="fc-screen">
        <Card c={cards[i]} n={i + 1} total={cards.length} source={source} onClick={() => go(1)} />
        <div className="fc-nav no-print">
          <button className="btn" type="button" onClick={() => go(-1)} disabled={i === 0}>← 이전</button>
          <span>{i + 1} / {cards.length}</span>
          <button className="btn" type="button" onClick={() => go(1)} disabled={i === cards.length - 1}>다음 →</button>
          <button className="btn" type="button" onClick={() => window.print()}>카드 출력</button>
        </div>
      </div>
      <div className="fc-print">
        {cards.map((c, k) => <Card key={k} c={c} n={k + 1} total={cards.length} source={source} />)}
      </div>
    </div>
  );
}

function Card({ c, n, total, source, onClick }) {
  return (
    <div className="fc-card" onClick={onClick}>
      <div className="fc-kicker">{c.kicker}</div>
      <h2 className="fc-title">{c.title}</h2>
      <div className={`fc-body${c.big ? ' big' : ''}`}>{c.body}</div>
      <div className="fc-foot"><span>{source ? `출처: ${source}` : '에이푸드 안전보건'}</span><span>{n} / {total}</span></div>
    </div>
  );
}
