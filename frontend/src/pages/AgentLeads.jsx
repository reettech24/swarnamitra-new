import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { Alert, Badge, Card, Field, date, money } from '../components/ui.jsx';

export default function AgentLeads() {
  const empty = { name: '', contact: '', loan_required: '', current_bank: '' };
  const [f, setF] = useState(empty);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = () => api.get('/leads').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leads', f);
      setF(empty); setMsg({ ok: 'Lead registered' }); load();
    } catch (e2) { setMsg({ error: errMsg(e2) }); }
  };

  return (
    <>
      <h1>My Leads</h1>
      <Card title="Register a new lead">
        <form onSubmit={submit}>
          <Alert {...msg} />
          <div className="grid">
            <Field label="Customer name"><input value={f.name} onChange={set('name')} required /></Field>
            <Field label="Contact (10-digit mobile)"><input value={f.contact} onChange={set('contact')} maxLength={10} required /></Field>
            <Field label="Loan required (₹)"><input type="number" value={f.loan_required} onChange={set('loan_required')} /></Field>
            <Field label="Loan with current bank"><input value={f.current_bank} onChange={set('current_bank')} /></Field>
          </div>
          <button className="btn">Submit Lead</button>
        </form>
      </Card>
      <Card title={`Lead status (${rows.length})`}>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Name</th><th>Contact</th><th>Loan required</th><th>Current bank</th><th>Status</th><th>Registered</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td>{r.contact}</td><td>{money(r.loan_required)}</td><td>{r.current_bank || '-'}</td><td><Badge value={r.status} /></td><td>{date(r.created_at)}</td></tr>
              ))}
              {!rows.length && <tr><td colSpan="6" className="muted">No leads yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
