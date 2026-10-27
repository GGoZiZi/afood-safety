'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 아직 만들지 않은 메뉴는 "준비중"으로 보이게 둔다
const MENU = [
  { href: '/risk', label: '위험성평가 대장' },
  { href: '/processes', label: '공정' },
  { href: '/tbm', label: 'TBM' },
  { href: '/improve', label: '개선조치' },
  { href: '/patrol', label: '순회점검' },
  { href: '/participation', label: '근로자 참여' },
  { href: '/equipment', label: '설비·안전인증' },
  { href: '/msds', label: 'MSDS' },
  { href: '/regulations', label: '실시규정' },
  { href: '/cases', label: '재해사례' },
  { href: '/budget', label: '예산', soon: true },
  { href: '/years', label: '연도 관리' },
  { href: '/users', label: '사용자' },
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="주 메뉴">
      {MENU.map((m) =>
        m.soon ? (
          <a key={m.href} className="soon" aria-disabled="true" title="다음 단계에서 만듭니다">
            {m.label}
          </a>
        ) : (
          <Link key={m.href} href={m.href} className={path.startsWith(m.href) ? 'on' : ''}>
            {m.label}
          </Link>
        ),
      )}
    </nav>
  );
}
