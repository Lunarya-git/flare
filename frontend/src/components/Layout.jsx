import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/exceptions', label: 'Exceptions' },
  { to: '/import', label: 'CSV Import' },
  { to: '/audit', label: 'Audit Log' },
];

export default function Layout({ title, children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">FL<span>A</span>RE</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
      </aside>
      <main className="main-content">
        <div className="topbar">
          <h1>{title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="user-badge">{user?.name} · {user?.role}</span>
            <button className="btn-logout" onClick={logout}>Log out</button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
