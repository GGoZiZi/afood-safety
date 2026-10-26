import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { addUser, updateUser } from './actions';
import MyPinForm from './MyPinForm';

export default async function UsersPage() {
  const me = await requireUser();
  const db = getDb();
  const depts = db.prepare('SELECT code FROM tbm_depts ORDER BY sort').all().map((d) => d.code);
  const users = me.role === 'admin' ? db.prepare('SELECT * FROM users ORDER BY active DESC, role, dept, name').all() : [];

  return (
    <main>
      <h1>사용자</h1>
      <p className="sub">{me.name}님으로 로그인 중 · {me.role === 'admin' ? '안전보건담당자(관리자)' : `${me.dept} 관리감독자`}</p>

      <MyPinForm />

      {me.role === 'admin' && (
        <>
          <h2>사용자 목록</h2>
          <p className="sub">관리자는 모든 메뉴를, 관리감독자는 자기 부서 TBM과 위험요인 추가·수정을 할 수 있습니다. PIN 칸에 값을 넣고 저장하면 PIN이 바뀝니다.</p>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="sheet" style={{ minWidth: 760 }}>
              <thead><tr><th>이름</th><th>권한</th><th>TBM 부서</th><th>사용</th><th>새 PIN</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <form action={updateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 6, padding: 6, alignItems: 'center' }}>
                        <input type="hidden" name="id" value={u.id} />
                        <select name="role" defaultValue={u.role} aria-label="권한">
                          <option value="admin">안전보건담당자(관리자)</option>
                          <option value="supervisor">관리감독자</option>
                        </select>
                        <select name="dept" defaultValue={u.dept ?? ''} aria-label="TBM 부서">
                          <option value="">-</option>
                          {depts.map((d) => <option key={d}>{d}</option>)}
                        </select>
                        <select name="active" defaultValue={String(u.active)} aria-label="사용">
                          <option value="1">사용</option>
                          <option value="0">중지</option>
                        </select>
                        <input type="password" name="pin" inputMode="numeric" placeholder="바꿀 때만" aria-label="새 PIN" />
                        <button className="btn small" type="submit">저장</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={addUser} className="card">
            <h2 style={{ marginTop: 0 }}>사용자 추가</h2>
            <div className="filters" style={{ border: 0, padding: 0 }}>
              <label>이름<input type="text" name="name" required /></label>
              <label>권한
                <select name="role" defaultValue="supervisor">
                  <option value="supervisor">관리감독자</option>
                  <option value="admin">안전보건담당자(관리자)</option>
                </select>
              </label>
              <label>TBM 부서
                <select name="dept" defaultValue="">
                  <option value="">-</option>
                  {depts.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label>PIN (숫자 4~8자리)<input type="password" name="pin" inputMode="numeric" required /></label>
              <button className="btn primary" type="submit">추가</button>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
