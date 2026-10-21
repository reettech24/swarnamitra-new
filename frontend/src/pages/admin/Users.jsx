import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { Alert, Card, Field, date } from '../../components/ui.jsx';

export default function Users() {
  const empty = { name: '', email: '', mobile: '', password: '', role: 'employee' };
  const [f, setF] = useState(empty);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = () => api.get('/admin/users').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const run = async (fn, ok) => {
    try { await fn(); setMsg({ ok }); load(); } catch (e) { setMsg({ error: errMsg(e) }); }
  };

  return (
    <>
      <h1>Users &amp; Roles</h1>
      <Alert {...msg} />
      <Card title="Add employee / agent / admin">
        <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/admin/users', f); setF(empty); }, 'User created'); }}>
          <div className="grid">
            <Field label="Name"><input value={f.name} onChange={set('name')} required /></Field>
            <Field label="Email"><input type="email" value={f.email} onChange={set('email')} required /></Field>
            <Field label="Mobile"><input value={f.mobile} onChange={set('mobile')} maxLength={10} required /></Field>
            <Field label="Password"><input type="password" value={f.password} onChange={set('password')} required /></Field>
            <Field label="Role">
              <select value={f.role} onChange={set('role')}>
                <option value="employee">Employee</option><option value="agent">Agent</option><option value="admin">Admin (owner)</option>
              </select>
            </Field>
          </div>
          <button className="btn">Create user</button>
        </form>
      </Card>
      <Card title="Team">
        <div className="tablewrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.email}</td><td>{u.mobile}</td><td>{u.role}</td>
                  <td><span className={`badge ${u.is_active ? 'won' : 'rejected'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                  <td>{date(u.created_at)}</td>
                  <td className="row">
                    <button className="btn outline sm" onClick={() => run(() => api.put(`/admin/users/${u.id}`, { is_active: !u.is_active }), 'Updated')}>{u.is_active ? 'Disable' : 'Enable'}</button>
                    <select style={{ width: 110, padding: '.2rem' }} value={u.role} onChange={(e) => run(() => api.put(`/admin/users/${u.id}`, { role: e.target.value }), 'Role updated')}>
                      <option value="employee">employee</option><option value="agent">agent</option><option value="admin">admin</option>
                    </select>
                    <button className="btn outline sm" onClick={() => { const p = prompt('New password (min 8 characters)'); if (p) run(() => api.put(`/admin/users/${u.id}`, { password: p }), 'Password reset'); }}>Reset password</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
