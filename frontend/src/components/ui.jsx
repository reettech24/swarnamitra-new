export const money = (n) => (n === null || n === undefined || n === '' ? '-' : '₹' + Number(n).toLocaleString('en-IN'));
export const date = (d) => (d ? String(d).slice(0, 10) : '-');
export const label = (s) => (s ? String(s).replace(/_/g, ' ') : '-');

export function Badge({ value, kind }) {
  if (!value) return <span className="muted">-</span>;
  return <span className={`badge ${kind || value}`}>{label(value)}</span>;
}

export function Tag({ ok, yes = 'Verified', no = 'Not verified' }) {
  return <span className={`badge ${ok ? 'won' : 'cold'}`}>{ok ? yes : no}</span>;
}

export function Field({ label: l, children, hint }) {
  return (
    <label className="field">
      <span>{l}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function Alert({ error, ok }) {
  if (error) return <div className="alert err">{error}</div>;
  if (ok) return <div className="alert ok">{ok}</div>;
  return null;
}

export function Card({ title, actions, children }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          <h3>{title}</h3>
          <div>{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}
