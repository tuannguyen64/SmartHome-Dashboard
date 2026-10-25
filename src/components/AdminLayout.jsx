import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { RealtimeProvider, useRealtimeStatus } from '../context/RealtimeContext.jsx';
import { isStaff, ROLES } from '../utils/constants.js';
import { USE_MOCK } from '../api/index.js';
import { FigmaIcon, Icon } from './icons.jsx';
import SimPanel from './SimPanel.jsx';
import { Spinner } from './ui.jsx';

const ADMIN_NAV = [
  { to: '/admin', label: 'Tổng quan Admin', end: true },
  { to: '/admin/users', label: 'Quản lý User', role: 'admin' },
  { to: '/admin/devices', label: 'Thiết bị & Bo mạch' },
  { to: '/admin/logs', label: 'Nhật ký Hệ thống' },
  { to: '/admin/settings', label: 'Cấu hình Cảnh báo & Server', role: 'admin' },
];

function AdminShell() {
  const { user, logout } = useAuth();
  const { connected } = useRealtimeStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRef = useRef(null);
  const name = user?.full_name || user?.username || 'Quản trị viên';
  const initial = name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || 'A';
  const nav = ADMIN_NAV.filter((item) => !item.role || item.role === user?.role);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <>
      <header className="admin-hdr">
        <div className="admin-hdr-inner">
          <NavLink to="/admin" className="hdr-brand">
            <span className="hdr-logo"><FigmaIcon name="house" size={17} /></span>
            <span>SmartHome</span>
          </NavLink>
          <nav className="admin-nav" aria-label="Điều hướng quản trị">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="admin-hdr-right">
            <span className={`admin-connection${connected ? ' is-connected' : ''}`} title={connected ? 'Đã kết nối máy chủ' : 'Mất kết nối máy chủ'}>
              <span className="dot" />
              <span className="admin-connection-label">{connected ? 'Đang kết nối' : 'Mất kết nối'}</span>
            </span>
            <NavLink to="/admin/logs" className="admin-bell" aria-label="Mở nhật ký hệ thống">
              <FigmaIcon name="bell" size={36} />
            </NavLink>
            <div className="admin-account" ref={accountRef}>
              <button
                className="admin-account-button"
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                aria-label="Mở menu tài khoản"
              >
                <span className="hdr-user-text">
                  <strong>{name.split(' ').pop()}</strong>
                  <span>{ROLES[user?.role]?.label ?? 'Quản trị viên'}</span>
                </span>
                <span className="avatar">{initial}</span>
                <Icon name="chevronDown" size={15} />
              </button>
              {accountMenuOpen && (
                <div className="admin-account-menu" role="menu">
                  <div className="admin-account-summary">
                    <strong>{name}</strong>
                    <span>@{user?.username}</span>
                  </div>
                  <Link to="/ca-nhan" role="menuitem">
                    <Icon name="user" size={16} /> Thông tin cá nhân
                  </Link>
                  <Link to="/thiet-bi" role="menuitem">
                    <Icon name="home" size={16} /> Vị trí và thiết bị
                  </Link>
                  <Link to="/admin" role="menuitem">
                    <Icon name="sliders" size={16} /> Bảng điều khiển Admin
                  </Link>
                  <button
                    className="danger"
                    role="menuitem"
                    type="button"
                    onClick={async () => {
                      setAccountMenuOpen(false);
                      await logout();
                      navigate('/dang-nhap');
                    }}
                  >
                    <Icon name="logout" size={16} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="admin-main"><Outlet /></main>
      {USE_MOCK && <SimPanel />}
    </>
  );
}

export default function AdminLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <div className="empty" style={{ height: '100vh' }}><Spinner /></div>;
  }
  if (!user) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  }
  if (!isStaff(user)) {
    return <div className="page"><div className="alert-box alert-box-red">Bạn không có quyền truy cập khu vực quản trị.</div></div>;
  }
  return <RealtimeProvider><AdminShell /></RealtimeProvider>;
}
