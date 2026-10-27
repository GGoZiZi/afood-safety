'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/health', label: '건강진단', admin: true },
  { href: '/health/measure', label: '작업환경측정', admin: true },
  { href: '/health/ppe', label: '보호구' },
];

export default function HealthTabs({ admin }) {
  const path = usePathname();
  const on = (h) => (h === '/health' ? path === h || /^\/health\/\d+/.test(path) : path.startsWith(h));
  return (
    <nav className="subtabs" aria-label="보건관리">
      {TABS.filter((t) => admin || !t.admin).map((t) => <Link key={t.href} href={t.href} className={on(t.href) ? 'on' : ''}>{t.label}</Link>)}
    </nav>
  );
}
