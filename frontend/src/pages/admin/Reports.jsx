import { useEffect, useState } from 'react';
import api, { download, errMsg } from '../../api';
import { Alert, Card } from '../../components/ui.jsx';

const TYPES = [['fees', 'Processing fees collection'], ['customers', 'Customer details'], ['leads', 'Leads']];
const PERIODS = [['weekly', 'Last 7 days'], ['monthly', 'Last month'], ['quarterly', 'Last 3 months'], ['half', 'Last 6 months'], ['annual', 'Last 12 months'], ['all', 'All time']];

export default function Reports() {
  const [type, setType] = useState('fees');
  const [period, setPeriod] = useState('monthly');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setData(null); setErr('');
    api.get(`/admin/reports/${type}`, { params: { period } }).then((r) => setData(r.data)).catch((e) => setErr(errMsg(e)));
  }, [type, period]);

  return (
    <>
      <h1>Reports</h1>
      <Card>
        <div className="row">
          <select style={{ maxWidth: 260 }} value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select style={{ maxWidth: 180 }} value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button className="btn" onClick={() => download(`/admin/reports/${type}`, `${type}-report.xlsx`, { period, format: 'xlsx' }).catch((e) => setErr(errMsg(e)))}>Download Excel</button>
        </div>
      </Card>
      <Alert error={err} />
      {data && (
        <Card title={`${data.rows.length} row(s)`}>
          <div className="tablewrap">
            <table>
              <thead><tr>{data.columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr></thead>
              <tbody>
                {data.rows.map((r, i) => <tr key={i}>{data.columns.map((c) => <td key={c.key}>{r[c.key] ?? '-'}</td>)}</tr>)}
                {!data.rows.length && <tr><td className="muted">No data for this period</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
