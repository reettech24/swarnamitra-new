import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api, { download, errMsg } from '../../api';
import { Alert, Badge, Card, Field, date, label, money } from '../../components/ui.jsx';
import { ext } from './Dashboard.jsx';

const STEPS = ['Personal & KYC', 'Loan details', 'Live photo', 'Documents', 'Fee & submit'];

export default function Application() {
  const [d, setD] = useState(null);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState({});
  const load = () => api.get('/customer/overview').then((r) => { setD(r.data); return r.data; });
  useEffect(() => { load(); }, []);
  if (!d) return <p>Loading...</p>;

  const flash = (m) => { setMsg(m); window.scrollTo(0, 0); };
  const props = { d, reload: load, flash, next: () => setStep((s) => Math.min(s + 1, 4)) };

  return (
    <>
      <h1>My Application</h1>
      <div className="steps">
        {STEPS.map((s, i) => (
          <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => setStep(i)} style={{ cursor: 'pointer' }}>{i + 1}. {s}</span>
        ))}
      </div>
      <Alert {...msg} />
      {step === 0 && <PersonalStep {...props} />}
      {step === 1 && <LoanStep {...props} />}
      {step === 2 && <SelfieStep {...props} />}
      {step === 3 && <DocsStep {...props} />}
      {step === 4 && <FeeStep {...props} />}
    </>
  );
}

function PersonalStep({ d, reload, next, flash }) {
  const p = d.profile;
  const [f, setF] = useState({ contact_no: p.contact_no || '', current_address: p.current_address || '', city: p.city || '', state: p.state || '', pincode: p.pincode || '', aadhaar_no: '', pan_no: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/customer/profile', f); await reload(); flash({ ok: 'Details saved' }); next(); } catch (x) { flash({ error: errMsg(x) }); }
  };
  return (
    <Card title="Personal details & KYC numbers">
      <form onSubmit={save}>
        <div className="grid">
          <Field label="Contact number"><input value={f.contact_no} onChange={set('contact_no')} required /></Field>
          <Field label="Pincode"><input value={f.pincode} onChange={set('pincode')} maxLength={6} /></Field>
          <Field label="City"><input value={f.city} onChange={set('city')} /></Field>
          <Field label="State"><input value={f.state} onChange={set('state')} /></Field>
        </div>
        <Field label="Current address"><textarea rows={2} value={f.current_address} onChange={set('current_address')} required /></Field>
        <div className="grid">
          <Field label="Aadhaar number" hint={p.aadhaar_masked ? `Saved: ${p.aadhaar_masked} (leave blank to keep)` : '12 digits'}>
            <input value={f.aadhaar_no} onChange={set('aadhaar_no')} maxLength={12} inputMode="numeric" required={!p.aadhaar_masked} />
          </Field>
          <Field label="PAN number" hint={p.pan_masked ? `Saved: ${p.pan_masked} (leave blank to keep)` : 'e.g. ABCDE1234F'}>
            <input value={f.pan_no} onChange={set('pan_no')} maxLength={10} style={{ textTransform: 'uppercase' }} required={!p.pan_masked} />
          </Field>
        </div>
        <p className="muted">Our team checks your Aadhaar and PAN against your documents and marks them as verified.</p>
        <button className="btn">Save &amp; continue</button>
      </form>
    </Card>
  );
}

function LoanStep({ d, reload, next, flash }) {
  const l = d.loan || {};
  const v = (k) => (l[k] === null || l[k] === undefined ? '' : String(l[k]).slice(0, k.includes('date') ? 10 : 99));
  const [f, setF] = useState({ old_bank: v('old_bank'), old_loan_amount: v('old_loan_amount'), old_roi: v('old_roi'), loan_start_date: v('loan_start_date'), loan_closure_date: v('loan_closure_date'), closure_amount: v('closure_amount'), new_bank: v('new_bank'), amount_required: v('amount_required') });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/customer/loan', f); await reload(); flash({ ok: 'Loan details saved' }); next(); } catch (x) { flash({ error: errMsg(x) }); }
  };
  return (
    <Card title="Loan details">
      <form onSubmit={save}>
        <h4>Current loan with existing bank</h4>
        <div className="grid">
          <Field label="Existing bank"><input value={f.old_bank} onChange={set('old_bank')} /></Field>
          <Field label="Outstanding loan amount (₹)"><input type="number" value={f.old_loan_amount} onChange={set('old_loan_amount')} /></Field>
          <Field label="Rate of interest (%)"><input type="number" step="0.01" value={f.old_roi} onChange={set('old_roi')} /></Field>
          <Field label="Loan start date"><input type="date" value={f.loan_start_date} onChange={set('loan_start_date')} /></Field>
          <Field label="Loan closure date"><input type="date" value={f.loan_closure_date} onChange={set('loan_closure_date')} /></Field>
          <Field label="Loan closure amount (₹)"><input type="number" value={f.closure_amount} onChange={set('closure_amount')} /></Field>
        </div>
        <h4>Proposed loan</h4>
        <div className="grid">
          <Field label="Proposed bank"><input value={f.new_bank} onChange={set('new_bank')} /></Field>
          <Field label="Loan amount required (₹)"><input type="number" value={f.amount_required} onChange={set('amount_required')} required /></Field>
        </div>
        <button className="btn">Save &amp; continue</button>
      </form>
    </Card>
  );
}

function SelfieStep({ d, reload, next, flash }) {
  const vid = useRef();
  const streamRef = useRef(null);
  const [live, setLive] = useState(false);
  const [shot, setShot] = useState(null);
  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setLive(false); };
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = s;
      vid.current.srcObject = s;
      await vid.current.play();
      setLive(true); setShot(null);
    } catch { flash({ error: 'Could not open the camera. Allow camera permission (the site must use https).' }); }
  };
  const capture = () => {
    const v = vid.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob((b) => { setShot({ blob: b, url: URL.createObjectURL(b) }); stop(); }, 'image/jpeg', 0.85);
  };
  const upload = async () => {
    const fd = new FormData();
    fd.append('doc_type', 'selfie');
    fd.append('file', shot.blob, 'selfie.jpg');
    try { await api.post('/customer/documents', fd); await reload(); setShot(null); flash({ ok: 'Photo uploaded' }); next(); } catch (x) { flash({ error: errMsg(x) }); }
  };

  return (
    <Card title="Live photo">
      <p>Take a clear photo of your face using your camera. {d.kyc.selfie && <>Status: <Badge value={d.kyc.selfie} /></>}</p>
      <video ref={vid} playsInline muted style={{ display: live ? 'block' : 'none', width: 320 }} />
      {shot && <img className="preview" src={shot.url} alt="Your photo" width={320} />}
      <div className="row" style={{ marginTop: '.6rem' }}>
        {!live && <button className="btn" onClick={start}>{shot || d.kyc.selfie ? 'Retake photo' : 'Open camera'}</button>}
        {live && <button className="btn" onClick={capture}>Capture</button>}
        {shot && <button className="btn" onClick={upload}>Use this photo</button>}
        <button className="btn outline" onClick={next}>Skip / Next</button>
      </div>
    </Card>
  );
}

function DocsStep({ d, reload, next, flash }) {
  const [type, setType] = useState('aadhaar');
  const [file, setFile] = useState(null);
  const upload = async (e) => {
    e.preventDefault();
    if (!file) return flash({ error: 'Choose a file' });
    const fd = new FormData();
    fd.append('doc_type', type);
    fd.append('file', file);
    try { await api.post('/customer/documents', fd); setFile(null); e.target.reset(); await reload(); flash({ ok: 'Document uploaded' }); } catch (x) { flash({ error: errMsg(x) }); }
  };
  const del = async (id) => {
    if (!confirm('Delete this document?')) return;
    try { await api.delete(`/customer/documents/${id}`); await reload(); } catch (x) { flash({ error: errMsg(x) }); }
  };
  const mine = d.documents.filter((x) => !['signed_agreement', 'noc'].includes(x.doc_type));
  return (
    <Card title="Attach documents">
      <form onSubmit={upload} className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Document type">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="aadhaar">Aadhaar card</option>
            <option value="pan">PAN card</option>
            <option value="cibil_report">CIBIL report</option>
            <option value="loan_receipt">Loan receipt</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="File (JPEG, PNG or PDF, max 5 MB)"><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFile(e.target.files[0])} /></Field>
        <button className="btn" style={{ marginBottom: '.8rem' }}>Upload</button>
      </form>
      <table><tbody>
        {mine.map((x) => (
          <tr key={x.id}>
            <td>{label(x.doc_type)}</td><td>{date(x.uploaded_at)}</td>
            <td>
              <button className="btn outline sm" onClick={() => download(`/files/${x.id}`, `${x.doc_type}${ext(x.mime_type)}`)}>View</button>{' '}
              <button className="btn danger sm" onClick={() => del(x.id)}>Delete</button>
            </td>
          </tr>
        ))}
        {!mine.length && <tr><td className="muted">Nothing uploaded yet</td></tr>}
      </tbody></table>
      <p><button className="btn" onClick={next}>Continue</button></p>
    </Card>
  );
}

function FeeStep({ d, reload, flash }) {
  const nav = useNavigate();
  const [ref, setRef] = useState(d.payment?.gateway_ref || '');
  const { fee, payment } = d;
  const upi = fee.upi_id ? `upi://pay?pa=${fee.upi_id}&pn=${encodeURIComponent(fee.payee_name)}&am=${fee.amount}&cu=INR&tn=${encodeURIComponent('Loan processing fee')}` : null;

  const sendRef = async (e) => {
    e.preventDefault();
    try { await api.post('/customer/fee', { reference: ref }); await reload(); flash({ ok: 'Payment reference submitted. Our team will confirm it shortly.' }); } catch (x) { flash({ error: errMsg(x) }); }
  };
  const submit = async () => {
    try { await api.post('/customer/submit'); nav('/portal'); } catch (x) { flash({ error: errMsg(x) }); }
  };

  return (
    <>
      <Card title="Loan processing fee">
        <p>Fee: <b>{money(fee.amount)}</b> {payment && <>· Status: <Badge value={payment.status} /></>}</p>
        {payment?.status === 'paid' ? <p>Your payment has been received. Thank you!</p> : (
          <>
            {upi ? (
              <div><QRCodeSVG value={upi} size={190} /><p className="muted">Scan with any UPI app to pay {fee.payee_name}</p></div>
            ) : <p className="muted">Payment details are not set up yet. Please contact our office.</p>}
            <form onSubmit={sendRef}>
              <Field label="After paying, enter the transaction reference / UTR number"><input value={ref} onChange={(e) => setRef(e.target.value)} required /></Field>
              <button className="btn">Submit payment reference</button>
            </form>
          </>
        )}
      </Card>
      <Card title="Finish">
        <p>When all steps are done, submit your application for processing.</p>
        <button className="btn" onClick={submit}>Complete verification &amp; submit</button>
      </Card>
    </>
  );
}
