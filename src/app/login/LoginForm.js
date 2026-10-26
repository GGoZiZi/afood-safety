'use client';

import { useActionState } from 'react';
import { createFirstAdmin, login } from './actions';

export default function LoginForm({ users, first }) {
  const [state, action, pending] = useActionState(first ? createFirstAdmin : login, null);
  return (
    <form action={action} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        이름
        {first ? (
          <input type="text" name="name" required placeholder="예: 최진휘" />
        ) : (
          <select name="name" required defaultValue="">
            <option value="" disabled>선택</option>
            {users.map((u) => (
              <option key={u.name} value={u.name}>
                {u.name} ({u.role === 'admin' ? '안전보건담당자' : `${u.dept ?? ''} 관리감독자`})
              </option>
            ))}
          </select>
        )}
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        PIN (숫자)
        <input type="password" name="pin" inputMode="numeric" pattern="\d{4,8}" required autoComplete="current-password" />
      </label>
      {state?.error && <p style={{ color: 'var(--danger)', margin: 0 }}>{state.error}</p>}
      <button className="btn primary" type="submit" disabled={pending} style={{ minHeight: 48 }}>
        {first ? '관리자 만들고 시작' : '로그인'}
      </button>
    </form>
  );
}
