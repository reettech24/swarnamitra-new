import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth, homeFor } from '../auth.jsx';

export default function PublicLayout() {
  const { user } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Suvarna Mitra<small>Finance</small></Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/about">About Us</NavLink>
          <NavLink to="/services">Services</NavLink>
          {user ? (
            <Link className="btn" to={homeFor(user.role)}>My Account</Link>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link className="btn" to="/register">Create Account</Link>
            </>
          )}
        </nav>
      </header>
      <Outlet />
      <footer className="footer">© {new Date().getFullYear()} Suvarna Mitra Finance. All rights reserved.</footer>
    </>
  );
}
