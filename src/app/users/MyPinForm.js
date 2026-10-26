'use client';

import { useActionState } from 'react';
import { changeMyPin } from './actions';

export default function MyPinForm() {
  const [state, action, pending] = useActionState(changeMyPin, null);
  return (
    <form action={action} className="card">
      <h2 style={{ marginTop: 0 }}>내 PIN 바꾸기</h2>
      <div className="filters" style={{ border: 0, padding: 0 }}>
        <label>지금 PIN<input type="password" name="old" inputMode="numeric" required /></label>
        <label>새 PIN (숫자 4~8자리)<input type="password" name="pin" inputMode="numeric" required /></label>
        <button className="btn" type="submit" disabled={pending}>바꾸기</button>
        {state?.error && <span style={{ color: 'var(--danger)' }}>{state.error}</span>}
        {state?.ok && <span style={{ color: 'var(--ok)' }}>{state.ok}</span>}
      </div>
    </form>
  );
}
