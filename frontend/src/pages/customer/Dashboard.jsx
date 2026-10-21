import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { download } from '../../api';
import { Badge, Card, Tag, date, label, money } from '../../components/ui.jsx';

export const ext = (m) => (m === 'application/pdf' ? '.pdf' : m === 'image/png' ? '.png' : '.jpg');

function Row({ k, v }) {
  return (
    <tr><td className="muted" style={{ width: '45%' }}>{k}</td><td>{v ?? '-'}</td></tr>
  );
}

export default function CustDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/customer/overview').then((r) => setD(r.data)); }, []);
  if (!d) return <p>Loading...</p>;

  const { user, profile: p, kyc, loan, payment, documents: docs } = d;
  const submitted = !!loan?.submitted_at;
  const hasDoc = docs.some((x) => !['signed_agreement', 'noc'].includes(x.doc_type));
  const agreement = docs.filter((x) => x.doc_type === 'signed_agreement');
  const noc = docs.some((x) => x.doc_type === 'noc');
  const step = (ok, text, extra) => <li>{ok ? '✅' : '⬜'} {text} {extra}</li>;

  return (
    <>
      <h1>Welcome, {user.name}</h1>
      <p className="muted">Customer ID: <b>{user.customer_code}</b> · Application status: <Badge value={d.application_status} /></p>

      {!submitted && (
        <Card title="Complete your application">
          <p>Finish the steps below to submit your loan request.</p>
          <Link className="btn" to="/portal/apply">Continue application</Link>
        </Card>
      )}

      {d.notifications.length > 0 && (
        <Card title="Notifications">
          {d.notifications.map((n) => <p key={n.id}>🔔 {n.message} <small className="muted">{date(n.created_at)}</small></p>)}
        </Card>
      )}

      <div className="charts">
        <Card title="Progress">
          <ul className="check" style={{ listStyle: 'none', padding: 0 }}>
            {step(!!(p.current_address && p.contact_no), 'Personal details')}
            {step(!!p.aadhaar_masked, 'Aadhaar added', p.aadhaar_masked && <Badge value={kyc.aadhaar || 'pending'} />)}
            {step(!!p.pan_masked, 'PAN added', p.pan_masked && <Badge value={kyc.pan || 'pending'} />)}
            {step(!!kyc.selfie, 'Live photo', kyc.selfie && <Badge value={kyc.selfie} />)}
            {step(hasDoc, 'Documents attached')}
            {step(!!loan?.amount_required, 'Loan details')}
            {step(payment?.status === 'paid', 'Processing fee paid', payment && <Badge value={payment.status} />)}
            {step(submitted, 'Application submitted')}
          </ul>
        </Card>

        <Card title="Personal details">
          <table><tbody>
            <Row k="Name" v={user.name} />
            <Row k="Address" v={[p.current_address, p.city, p.state, p.pincode].filter(Boolean).join(', ') || '-'} />
            <Row k="Mobile" v={<>{user.mobile} <Tag ok={!!user.mobile_verified} /></>} />
            <Row k="Email" v={<>{user.email} <Tag ok={!!user.email_verified} /></>} />
            <Row k="Aadhaar" v={p.aadhaar_masked ? <>{p.aadhaar_masked} <Tag ok={kyc.aadhaar === 'verified'} /></> : 'Missing'} />
            <Row k="PAN card" v={p.pan_masked ? <>{p.pan_masked} <Tag ok={kyc.pan === 'verified'} yes="Attached" no="Attached (pending check)" /></> : 'Missing'} />
          </tbody></table>
        </Card>
      </div>

      <Card title="Loan details">
        {loan ? (
          <table><tbody>
            <Row k="Loan status" v={<Badge value={loan.loan_status} />} />
            <Row k="Existing bank" v={loan.old_bank} />
            <Row k="Start date of loan" v={date(loan.loan_start_date)} />
            <Row k="Loan closure date" v={date(loan.loan_closure_date)} />
            <Row k="Loan closure amount" v={money(loan.closure_amount)} />
            <Row k="Loan closure NOC" v={noc ? 'Attached' : 'Not received yet'} />
            <Row k="New loan with bank" v={loan.new_bank} />
            <Row k="Loan amount" v={money(loan.new_loan_amount || loan.amount_required)} />
            <Row k="Date of transfer to new bank" v={date(loan.transfer_date)} />
            <Row k="Rate of interest" v={loan.new_roi ? loan.new_roi + '%' : '-'} />
          </tbody></table>
        ) : <p className="muted">No loan details added yet.</p>}
      </Card>

      <Card title="Documents">
        {agreement.map((a) => (
          <p key={a.id}><button className="btn sm" onClick={() => download(`/files/${a.id}`, `signed-agreement${ext(a.mime_type)}`)}>Download signed agreement</button></p>
        ))}
        {docs.filter((x) => x.doc_type !== 'signed_agreement').map((x) => (
          <p key={x.id}>
            {label(x.doc_type)} <small className="muted">({date(x.uploaded_at)})</small>{' '}
            <button className="btn outline sm" onClick={() => download(`/files/${x.id}`, `${x.doc_type}${ext(x.mime_type)}`)}>Download</button>
          </p>
        ))}
        {!docs.length && <p className="muted">No documents uploaded yet.</p>}
      </Card>
    </>
  );
}
