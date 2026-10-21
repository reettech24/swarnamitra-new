import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { download, errMsg } from '../../api';
import { Alert, Badge, Card, Field, date, label, money } from '../../components/ui.jsx';
import { ext } from '../customer/Dashboard.jsx';

const STATUSES = ['hot', 'warm', 'cold', 'lost', 'won'];
const Check = ({ text, checked, onChange }) => (
  <label className="row" style={{ marginBottom: '.5rem' }}>
    <input type="checkbox" style={{ width: 'auto' }} checked={checked} onChange={(e) => onChange(e.target.checked)} /> {text}
  </label>
);

export default function CustomerDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [ver, setVer] = useState(0);
  const [msg, setMsg] = useState({});
  const load = () => api.get(`/admin/customers/${id}`).then((r) => { setD(r.data); setVer((v) => v + 1); });
  useEffect(() => { load(); }, [id]);
  if (!d) return <p>Loading...</p>;

  const run = async (fn, ok = 'Saved') => {
    try { await fn(); await load(); setMsg({ ok }); } catch (e) { setMsg({ error: errMsg(e) }); }
    window.scrollTo(0, 0);
  };
  const c = { d, run, id };

  return (
    <>
      <p><Link to="/admin/leads">← Back to list</Link></p>
      <h1>{d.user.name} <small className="muted">{d.user.customer_code}</small></h1>
      <Alert {...msg} />
      <div className="charts">
        <ProfileCard key={ver} {...c} />
        <LoanCard key={ver} {...c} />
      </div>
      <div className="charts">
        <FeeCard key={ver} {...c} />
        <LeadCard key={ver} {...c} />
      </div>
      <DocsCard key={ver} {...c} />
      <RejectionCard key={ver} {...c} />
    </>
  );
}

function ProfileCard({ d, run, id }) {
  const p = d.profile || {};
  const [f, setF] = useState({
    name: d.user.name, contact_no: p.contact_no || '', current_address: p.current_address || '', city: p.city || '', state: p.state || '', pincode: p.pincode || '',
    aadhaar_name: p.aadhaar_name || '', cibil_score: p.cibil_score || '',
    mobile_verified: !!d.user.mobile_verified, email_verified: !!d.user.email_verified,
    aadhaar_verified: d.kyc.aadhaar === 'verified', pan_verified: d.kyc.pan === 'verified', selfie_verified: d.kyc.selfie === 'verified',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const tick = (k) => (v) => setF({ ...f, [k]: v });
  return (
    <Card title="Personal details & verification">
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/admin/customers/${id}`, f)); }}>
        <p className="muted">Email: {d.user.email} · Mobile: {d.user.mobile}<br />Aadhaar: {p.aadhaar_no || '-'} · PAN: {p.pan_no || '-'}</p>
        <div className="grid">
          <Field label="Name (as entered by customer)"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="Name as per Aadhaar card"><input value={f.aadhaar_name} onChange={set('aadhaar_name')} /></Field>
          <Field label="Contact"><input value={f.contact_no} onChange={set('contact_no')} /></Field>
          <Field label="CIBIL score (300-900)"><input type="number" value={f.cibil_score} onChange={set('cibil_score')} /></Field>
          <Field label="City"><input value={f.city} onChange={set('city')} /></Field>
          <Field label="State"><input value={f.state} onChange={set('state')} /></Field>
          <Field label="Pincode"><input value={f.pincode} onChange={set('pincode')} /></Field>
        </div>
        <Field label="Address"><textarea rows={2} value={f.current_address} onChange={set('current_address')} /></Field>
        <div className="row" style={{ gap: '1.2rem' }}>
          <Check text="Mobile verified" checked={f.mobile_verified} onChange={tick('mobile_verified')} />
          <Check text="Email verified" checked={f.email_verified} onChange={tick('email_verified')} />
          <Check text="Aadhaar verified" checked={f.aadhaar_verified} onChange={tick('aadhaar_verified')} />
          <Check text="PAN verified" checked={f.pan_verified} onChange={tick('pan_verified')} />
          <Check text="Live photo verified" checked={f.selfie_verified} onChange={tick('selfie_verified')} />
        </div>
        <button className="btn">Save</button>
      </form>
    </Card>
  );
}

function LoanCard({ d, run, id }) {
  const l = d.loan || {};
  const v = (k) => (l[k] === null || l[k] === undefined ? '' : String(l[k]).slice(0, k.includes('date') || k.endsWith('_on') ? 10 : 99));
  const keys = ['old_bank', 'old_loan_amount', 'old_roi', 'loan_start_date', 'loan_closure_date', 'closure_amount', 'new_bank', 'amount_required', 'new_loan_amount', 'new_roi', 'transfer_date', 'disbursed_on'];
  const [f, setF] = useState({ ...Object.fromEntries(keys.map((k) => [k, v(k)])), loan_status: l.loan_status || 'in_process' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const fld = (k, text, type = 'text', step) => <Field label={text}><input type={type} step={step} value={f[k]} onChange={set(k)} /></Field>;
  return (
    <Card title="Loan details" actions={l.submitted_at && <span className="badge won">Submitted {date(l.submitted_at)}</span>}>
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/admin/customers/${id}/loan`, f)); }}>
        <div className="grid">
          <Field label="Loan status">
            <select value={f.loan_status} onChange={set('loan_status')}>
              <option value="in_process">In process</option><option value="sanctioned">Sanctioned</option><option value="rejected">Rejected</option>
            </select>
          </Field>
          {fld('old_bank', 'Old bank')}{fld('old_loan_amount', 'Old loan amount', 'number')}{fld('old_roi', 'Old ROI %', 'number', '0.01')}
          {fld('loan_start_date', 'Loan start date', 'date')}{fld('loan_closure_date', 'Loan closure date', 'date')}{fld('closure_amount', 'Closure amount', 'number')}
          {fld('new_bank', 'New bank')}{fld('amount_required', 'Amount required', 'number')}{fld('new_loan_amount', 'Sanctioned / new loan amount', 'number')}
          {fld('new_roi', 'New ROI %', 'number', '0.01')}{fld('transfer_date', 'Date of transfer to new bank', 'date')}{fld('disbursed_on', 'Disbursed on', 'date')}
        </div>
        <button className="btn">Save loan details</button>
      </form>
    </Card>
  );
}

function FeeCard({ d, run, id }) {
  const pay = d.payment;
  const [s, setS] = useState(pay?.status || 'pending');
  return (
    <Card title="Processing fee">
      {pay ? (
        <p>Amount: <b>{money(pay.amount)}</b> · Status: <Badge value={pay.status} /><br />Customer's payment reference: <b>{pay.gateway_ref || 'not submitted yet'}</b>{pay.paid_at && <><br />Paid on {date(pay.paid_at)}</>}</p>
      ) : <p className="muted">Customer has not started the fee payment.</p>}
      <div className="row">
        <select style={{ maxWidth: 160 }} value={s} onChange={(e) => setS(e.target.value)}>
          <option value="pending">Pending</option><option value="paid">Paid (received)</option><option value="failed">Failed</option>
        </select>
        <button className="btn" onClick={() => run(() => api.put(`/admin/customers/${id}/fee`, { status: s }), 'Fee status updated')}>Update</button>
      </div>
      <p className="muted">Marking the fee as Paid automatically turns the lead to Won.</p>
    </Card>
  );
}

function LeadCard({ d, run }) {
  const lead = d.lead;
  if (!lead) return <Card title="Lead"><p className="muted">No lead record.</p></Card>;
  return (
    <Card title="Lead status">
      <div className="row">
        <Badge value={lead.status} />
        <select style={{ maxWidth: 140 }} value={lead.status} onChange={(e) => run(() => api.put(`/leads/${lead.id}/status`, { status: e.target.value }), 'Lead status updated')}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <table><tbody>
        {d.history.map((h, i) => <tr key={i}><td>{date(h.changed_at)}</td><td>{h.old_status || 'new'} → <b>{h.new_status}</b></td><td className="muted">{h.reason}</td></tr>)}
      </tbody></table>
    </Card>
  );
}

function DocsCard({ d, run, id }) {
  const [type, setType] = useState('signed_agreement');
  const [file, setFile] = useState(null);
  const upload = (e) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('doc_type', type);
    fd.append('file', file);
    run(() => api.post(`/admin/customers/${id}/documents`, fd), 'Document added');
    e.target.reset(); setFile(null);
  };
  return (
    <Card title="Documents">
      <table><tbody>
        {d.documents.map((x) => (
          <tr key={x.id}>
            <td>{label(x.doc_type)}</td><td>{date(x.uploaded_at)}</td>
            <td>
              <button className="btn outline sm" onClick={() => download(`/files/${x.id}`, `${x.doc_type}-${x.id}${ext(x.mime_type)}`)}>Download</button>{' '}
              <button className="btn danger sm" onClick={() => confirm('Delete this document?') && run(() => api.delete(`/admin/documents/${x.id}`), 'Deleted')}>Delete</button>
            </td>
          </tr>
        ))}
        {!d.documents.length && <tr><td className="muted">No documents</td></tr>}
      </tbody></table>
      <form className="row" style={{ marginTop: '1rem' }} onSubmit={upload}>
        <select style={{ maxWidth: 200 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="signed_agreement">Signed agreement (customer can download)</option>
          <option value="noc">Loan closure NOC</option>
          <option value="other">Other</option>
        </select>
        <input type="file" style={{ maxWidth: 260 }} accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFile(e.target.files[0])} />
        <button className="btn">Upload for customer</button>
      </form>
    </Card>
  );
}

function RejectionCard({ d, run, id }) {
  const empty = { bank_name: '', processing_date: '', loan_amount: '', concerned_person: '', reason: '' };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Loan rejection history">
      <table>
        <thead><tr><th>Bank</th><th>Processing date</th><th>Loan amount</th><th>Concerned person</th><th>Reason</th></tr></thead>
        <tbody>
          {d.rejections.map((r) => <tr key={r.id}><td>{r.bank_name}</td><td>{date(r.processing_date)}</td><td>{money(r.loan_amount)}</td><td>{r.concerned_person || '-'}</td><td>{r.reason || '-'}</td></tr>)}
          {!d.rejections.length && <tr><td colSpan="5" className="muted">No rejections recorded</td></tr>}
        </tbody>
      </table>
      <form style={{ marginTop: '1rem' }} onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/admin/customers/${id}/rejections`, f), 'Rejection recorded, lead marked Lost'); }}>
        <h4>Record a rejection (marks the lead as Lost)</h4>
        <div className="grid">
          <Field label="Bank name"><input value={f.bank_name} onChange={set('bank_name')} required /></Field>
          <Field label="Processing date"><input type="date" value={f.processing_date} onChange={set('processing_date')} /></Field>
          <Field label="Loan amount"><input type="number" value={f.loan_amount} onChange={set('loan_amount')} /></Field>
          <Field label="Concerned person"><input value={f.concerned_person} onChange={set('concerned_person')} /></Field>
        </div>
        <Field label="Reason"><input value={f.reason} onChange={set('reason')} /></Field>
        <button className="btn danger">Record rejection</button>
      </form>
    </Card>
  );
}
