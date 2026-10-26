import { redirect } from 'next/navigation';

// 대시보드는 TBM 단계에서 추가. 지금은 대장으로 바로 이동
export default function Home() {
  redirect('/risk');
}
