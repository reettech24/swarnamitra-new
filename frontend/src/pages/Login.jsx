import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth.jsx';
import { errMsg } from '../api';
import { Alert, Field } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ identifier: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const u = await login(f.identifier, f.password);
      nav(homeFor(u.role));
    } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };

  return (
    <div className="authbox">
      <form className="card" onSubmit={submit}>
        <h2>Login</h2>
        <Alert error={err} />
        <Field label="Email or mobile number"><input value={f.identifier} onChange={(e) => setF({ ...f, identifier: e.target.value })} autoFocus required /></Field>
        <Field label="Password"><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <button className="btn" disabled={busy}>{busy ? 'Please wait...' : 'Login'}</button>
        <p className="muted">New here? <Link to="/register">Create an account</Link></p>
      </form>
    </div>
  );
}
