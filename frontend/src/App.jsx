import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeFor } from './auth.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import Portal from './components/Portal.jsx';
import { Home, About, Services } from './pages/Public.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import CustDashboard from './pages/customer/Dashboard.jsx';
import Application from './pages/customer/Application.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import Leads from './pages/admin/Leads.jsx';
import CustomerDetail from './pages/admin/CustomerDetail.jsx';
import Reports from './pages/admin/Reports.jsx';
import Users from './pages/admin/Users.jsx';
import Settings from './pages/admin/Settings.jsx';
import AgentLeads from './pages/AgentLeads.jsx';

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route path="/portal" element={<Guard roles={['customer']}><Portal /></Guard>}>
        <Route index element={<CustDashboard />} />
        <Route path="apply" element={<Application />} />
      </Route>

      <Route path="/admin" element={<Guard roles={['admin', 'employee']}><Portal /></Guard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Guard roles={['admin']}><Users /></Guard>} />
        <Route path="settings" element={<Guard roles={['admin']}><Settings /></Guard>} />
      </Route>

      <Route path="/agent" element={<Guard roles={['agent']}><Portal /></Guard>}>
        <Route index element={<AgentLeads />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
