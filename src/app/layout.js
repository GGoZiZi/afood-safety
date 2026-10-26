import './globals.css';
import Link from 'next/link';
import NavLinks from '@/components/NavLinks';
import YearSelect from '@/components/YearSelect';
import { listYears } from '@/lib/risk';
import { currentYear } from '@/lib/year';
import { currentUser } from '@/lib/auth';
import { logout } from './login/actions';

export const metadata = {
  title: '에이푸드 위험성평가 관리',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }) {
  const years = listYears();
  const year = await currentYear();
  const user = await currentUser();
  return (
    <html lang="ko">
      <body>
        <header className="topbar no-print">
          <Link href="/risk" className="brand">에이푸드 안전보건</Link>
          {user && <NavLinks />}
          {user && years.length > 0 && <YearSelect years={years} current={year} />}
          {user && (
            <div className="userbox">
              <Link href="/users">{user.name}</Link>
              <form action={logout}><button type="submit">로그아웃</button></form>
            </div>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
