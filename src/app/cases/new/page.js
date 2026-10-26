import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { listTbmDepts, today } from '@/lib/tbm';
import CaseForm from '@/components/CaseForm';
import { createCase } from '../actions';

export default async function NewCase() {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/cases');
  return (
    <main>
      <p><Link href="/cases">← 재해사례</Link></p>
      <h1>재해사례 추가</h1>
      <CaseForm action={createCase} c={{ share_from: today() }} depts={listTbmDepts().map((d) => d.code)} submitLabel="추가" />
    </main>
  );
}
