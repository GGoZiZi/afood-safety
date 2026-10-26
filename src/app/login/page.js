import { getDb } from '@/lib/db';
import LoginForm from './LoginForm';

export default function LoginPage() {
  const db = getDb();
  const users = db.prepare('SELECT name, role, dept FROM users WHERE active = 1 ORDER BY role, dept, name').all();
  const hasAdmin = users.some((u) => u.role === 'admin');
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>로그인</h1>
      {!hasAdmin ? (
        <>
          <p className="sub">처음 사용입니다. 안전보건담당자(관리자) 계정을 만드세요.</p>
          <LoginForm users={[]} first />
        </>
      ) : (
        <>
          <p className="sub">이름을 고르고 PIN을 입력하세요.</p>
          <LoginForm users={users} />
        </>
      )}
    </main>
  );
}
