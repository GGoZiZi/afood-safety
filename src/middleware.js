import { NextResponse } from 'next/server';

// 로그인 쿠키가 없으면 로그인 화면으로. (쿠키가 진짜인지는 각 화면·작업에서 DB로 확인)
export function middleware(req) {
  if (!req.cookies.get('afood_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|_next|favicon.ico).*)'],
};
