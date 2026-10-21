import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { Alert, Card, Field } from '../../components/ui.jsx';

export default function Settings() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState({});
  useEffect(() => { api.get('/admin/settings').then((r) => setF(r.data)); }, []);
  if (!f) return <p>Loading...</p>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { setF((await api.put('/admin/settings', f)).data); setMsg({ ok: 'Settings saved' }); } catch (x) { setMsg({ error: errMsg(x) }); }
  };
  return (
    <>
      <h1>Settings</h1>
      <Card title="Loan processing fee &amp; payment QR">
        <form onSubmit={save} style={{ maxWidth: 480 }}>
          <Alert {...msg} />
          <Field label="Processing fee (₹)"><input type="number" value={f.processing_fee} onChange={set('processing_fee')} required /></Field>
          <Field label="UPI ID for the payment QR" hint="e.g. suvarnamitra@okbank. The customer sees a QR generated from this."><input value={f.upi_id} onChange={set('upi_id')} /></Field>
          <Field label="Payee name"><input value={f.payee_name} onChange={set('payee_name')} /></Field>
          <button className="btn">Save</button>
        </form>
      </Card>
    </>
  );
}
