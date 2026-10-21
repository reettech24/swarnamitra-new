import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { Alert, Badge, Card, money } from '../../components/ui.jsx';

const STATUSES = ['hot', 'warm', 'cold', 'lost', 'won'];
const tick = (ok) => <span title={ok ? 'Verified' : 'Not verified'} style={{ color: ok ? '#2f9e5b' : '#c0392b' }}>{ok ? ' ✔' : ' ✖'}</span>;

export default function Leads() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState({});
  const load = () => api.get('/leads', { params: { q, status } }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [status]);

  const change = async (id, s) => {
    try { await api.put(`/leads/${id}/status`, { status: s }); load(); } catch (e) { setMsg({ error: errMsg(e) }); }
  };

  return (
    <>
      <h1>Leads &amp; Customers</h1>
      <Alert {...msg} />
      <Card>
        <form className="row" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input style={{ maxWidth: 280 }} placeholder="Search name, contact or customer ID" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn">Search</button>
        </form>
      </Card>
      <Card title={`${rows.length} record(s)`}>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Customer ID</th><th>Name</th><th>Contact</th><th>Email</th><th>CIBIL</th><th>Loan status</th><th>Lead status</th><th>Fees</th><th>Old loan</th><th>Old ROI</th><th>New loan</th><th>New ROI</th><th>Agent</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.customer_user_id ? 'click' : ''} onClick={() => r.customer_user_id && nav(`/admin/customers/${r.customer_user_id}`)}>
                  <td>{r.customer_code || <span className="muted">Agent lead</span>}</td>
                  <td>{r.name}</td>
                  <td>{r.contact}{r.customer_user_id && tick(r.mobile_verified)}</td>
                  <td>{r.email || '-'}{r.customer_user_id && tick(r.email_verified)}</td>
                  <td>{r.cibil_score || '-'}</td>
                  <td><Badge value={r.loan_status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select style={{ width: 90, padding: '.2rem' }} value={r.status} onChange={(e) => change(r.id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>{r.fee_status ? <Badge value={r.fee_status === 'paid' ? 'paid' : 'pending'} /> : <span className="muted">-</span>}{r.fee_status === 'paid' ? ' Received' : r.fee_status ? ' Pending' : ''}</td>
                  <td>{money(r.old_loan_amount)}</td><td>{r.old_roi ? r.old_roi + '%' : '-'}</td>
                  <td>{money(r.new_loan_amount || r.amount_required || r.loan_required)}</td><td>{r.new_roi ? r.new_roi + '%' : '-'}</td>
                  <td>{r.agent_name || '-'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="13" className="muted">No records</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
