import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BrandMark, Icon } from './Icon';
import { useSession, ROLE_LABEL } from '../lib/session';
import { initials } from '../lib/format';
import { useToast } from './ui';

const NAV: { group: string; items: { to: string; label: string; icon: string; end?: boolean }[] }[] = [
  {
    group: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
      { to: '/admin/quizzes', label: 'Quizzes', icon: 'quiz' },
    ],
  },
  {
    group: 'Delivery',
    items: [
      { to: '/admin/live', label: 'Live console', icon: 'play' },
      { to: '/admin/participants', label: 'Participants', icon: 'users' },
      { to: '/admin/results', label: 'Results', icon: 'chart' },
      { to: '/admin/certificates', label: 'Certificates', icon: 'certificate' },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { to: '/admin/fields', label: 'Registration form', icon: 'edit' },
      { to: '/admin/sheets', label: 'Spreadsheet sync', icon: 'sheet' },
      { to: '/admin/emails', label: 'Email log', icon: 'mail' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/admin/settings', label: 'Settings', icon: 'settings' },
      { to: '/admin/users', label: 'Team & access', icon: 'shield' },
      { to: '/admin/audit', label: 'Audit trail', icon: 'eye' },
    ],
  },
];

export function AdminLayout({
  title,
  crumb,
  actions,
  children,
}: {
  title: string;
  crumb?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const signOut = async () => {
    await logout();
    toast('Signed out.', 'success');
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell">
      {menuOpen ? <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <BrandMark />
        <nav className="stack" style={{ gap: 2 }}>
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="nav-group-label">{section.group}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="nav-icon">
                    <Icon name={item.icon} size={16} />
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="row" style={{ gap: 9, marginBottom: 10 }}>
            <div
              className="brand-mark"
              style={{ width: 32, height: 32, borderRadius: 9, fontSize: 12, background: 'rgba(211,171,85,.16)', color: 'var(--gold-300)', boxShadow: 'none', border: '1px solid rgba(211,171,85,.3)' }}
            >
              {initials(user?.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name ?? 'Administrator'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--gold-300)' }}>{user ? ROLE_LABEL[user.role] : ''}</div>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" style={{ color: 'rgba(239,231,245,.75)', width: '100%', justifyContent: 'flex-start', paddingLeft: 0 }} onClick={signOut}>
            <Icon name="logout" size={14} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-sm btn-icon menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
            <Icon name="menu" />
          </button>
          <div>
            <div className="topbar-title">{title}</div>
            {crumb ? <div className="topbar-crumb">{crumb}</div> : null}
          </div>
          <div className="topbar-actions">{actions}</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
