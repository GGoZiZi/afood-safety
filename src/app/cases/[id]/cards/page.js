import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import FlashCards from '@/components/FlashCards';

// TBM 때 화면에 띄우거나 출력해서 보여주는 사례 카드 (A4 가로 한 장에 한 장씩)
export default async function CaseCards({ params }) {
  await requireUser();
  const { id } = await params;
  const c = getDb().prepare('SELECT * FROM accident_cases WHERE id = ?').get(Number(id));
  if (!c) notFound();
  const cards = [
    { kicker: `재해사례 · ${c.category ?? ''}${c.occurred_on ? ` · ${c.occurred_on}` : ''}`, title: '무슨 일이 있었나', body: c.title, big: true },
    c.summary && { kicker: '사고 개요', title: '어떻게 일어났나', body: c.summary },
    c.cause && { kicker: '원인', title: '왜 일어났나', body: c.cause },
    { kicker: '우리 사업장', title: '우리는 이렇게 지킨다', body: c.prevention ?? '관리감독자와 함께 우리 작업에서 같은 위험이 있는지 이야기해 보세요.' },
  ].filter(Boolean);
  return (
    <div>
      <p className="no-print" style={{ padding: '12px 16px', margin: 0 }}><Link href={`/cases/${c.id}`}>← 사례 상세</Link></p>
      <FlashCards cards={cards} source={c.source} />
    </div>
  );
}
