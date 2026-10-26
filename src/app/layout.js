import './globals.css';
import Link from 'next/link';
import NavLinks from '@/components/NavLinks';
import YearSelect from '@/components/YearSelect';
import { listYears } from '@/lib/risk';
import { currentYear } from '@/lib/year';

export const metadata = {
  title: '에이푸드 위험성평가 관리',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }) {
  const years = listYears();
  const year = await currentYear();
  return (
    <html lang="ko">
      <body>
        <header className="topbar no-print">
          <Link href="/risk" className="brand">에이푸드 안전보건</Link>
          <NavLinks />
          {years.length > 0 && <YearSelect years={years} current={year} />}
        </header>
        {children}
      </body>
    </html>
  );
}
