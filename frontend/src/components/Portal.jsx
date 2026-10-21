import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const LINKS = {
  customer: [['/portal', 'Dashboard'], ['/portal/apply', 'My Application']],
  agent: [['/agent', 'My Leads']],
  employee: [['/admin', 'Dashboard'], ['/admin/leads', 'Leads & Customers'], ['/admin/reports', 'Reports']],
  admin: [['/admin', 'Dashboard'], ['/admin/leads', 'Leads & Customers'], ['/admin/reports', 'Reports'], ['/admin/users', 'Users & Roles'], ['/admin/settings', 'Settings']],
};

export default function Portal() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="portal">
      <aside className="sidebar">
        <div className="brand">Suvarna Mitra<small>Finance</small></div>
        <nav>
          {LINKS[user.role].map(([to, text]) => (
            <NavLink key={to} to={to} end>{text}</NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div>{user.name}</div>
          <small className="muted">{user.role}{user.customer_code ? ` · ${user.customer_code}` : ''}</small>
          <button className="btn ghost" onClick={() => { logout(); nav('/'); }}>Log out</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
