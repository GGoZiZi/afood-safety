import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

// 관리자는 위험성평가 대장, 관리감독자는 TBM으로 바로 이동
export default async function Home() {
  const user = await requireUser();
  redirect(user.role === 'admin' ? '/risk' : '/tbm');
}
