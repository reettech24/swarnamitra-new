import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api';
import { Alert, Field } from '../components/ui.jsx';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', mobile: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await register(f);
      nav('/portal/apply');
    } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };

  return (
    <div className="authbox">
      <form className="card" onSubmit={submit}>
        <h2>Create Account</h2>
        <Alert error={err} />
        <Field label="Full name"><input value={f.name} onChange={set('name')} required /></Field>
        <Field label="Email ID"><input type="email" value={f.email} onChange={set('email')} required /></Field>
        <Field label="Mobile number"><input value={f.mobile} onChange={set('mobile')} maxLength={10} inputMode="numeric" required /></Field>
        <Field label="Password" hint="At least 8 characters"><input type="password" value={f.password} onChange={set('password')} required /></Field>
        <Field label="Confirm password"><input type="password" value={f.confirm} onChange={set('confirm')} required /></Field>
        <button className="btn" disabled={busy}>{busy ? 'Please wait...' : 'Create Account'}</button>
        <p className="muted">Already registered? <Link to="/login">Login</Link></p>
      </form>
    </div>
  );
}


// My name is approva
