import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../api';
import { Card, date, money } from '../../components/ui.jsx';

const COLORS = { hot: '#e8590c', warm: '#f2b01e', cold: '#4a90d9', lost: '#9aa5b1', won: '#2f9e5b' };

function Bars({ data, color, fmt }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip formatter={fmt} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  const [notes, setNotes] = useState([]);
  const [group, setGroup] = useState('month');
  const [range, setRange] = useState({ from: '', to: '' });

  const load = (params) => api.get('/admin/dashboard', { params }).then((r) => setD(r.data));
  useEffect(() => { load(); api.get('/admin/notifications').then((r) => setNotes(r.data)); }, []);
  if (!d) return <p>Loading...</p>;

  return (
    <>
      <h1>Dashboard</h1>
      <div className="stats">
        <div className="stat"><span className="muted">Total customers</span><b>{d.customers}</b></div>
        <div className="stat"><span className="muted">Processing fees collected</span><b>{money(d.fees_total)}</b></div>
        <div className="stat"><span className="muted">Fee payments to confirm</span><b>{d.fees_to_confirm}</b></div>
        <div className="stat"><span className="muted">Loans disbursed ({d.disbursed.count})</span><b>{money(d.disbursed.total)}</b></div>
      </div>

      <div className="charts">
        <Card title="Monthly customer registrations"><Bars data={d.registrations} color="#102a43" /></Card>
        <Card title="Processing fees collection"><Bars data={d.fees} color="#c8962b" fmt={(v) => money(v)} /></Card>
        <Card title="Leads: Hot / Warm / Cold / Lost / Won">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={d.leads} dataKey="value" nameKey="label" outerRadius={85} label>
                {d.leads.map((e) => <Cell key={e.label} fill={COLORS[e.label] || '#999'} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Loans disbursed">
          <div className="tabs">
            {['month', 'quarter', 'year'].map((g) => <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{g === 'month' ? 'Monthly' : g === 'quarter' ? 'Quarterly' : 'Annual'}</button>)}
          </div>
          <Bars data={d.disbursed[group]} color="#2f9e5b" fmt={(v) => money(v)} />
          <div className="row">
            <input type="date" style={{ width: 150 }} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <input type="date" style={{ width: 150 }} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            <button className="btn sm" disabled={!range.from || !range.to} onClick={() => load(range)}>Custom range</button>
            <button className="btn outline sm" onClick={() => { setRange({ from: '', to: '' }); load(); }}>Reset</button>
          </div>
        </Card>
      </div>

      <Card title="Recent notifications">
        {notes.map((n) => <p key={n.id}>🔔 {n.message} <small className="muted">{date(n.created_at)}</small></p>)}
        {!notes.length && <p className="muted">No notifications</p>}
      </Card>
    </>
  );
}
