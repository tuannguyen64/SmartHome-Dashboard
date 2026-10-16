import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { api, USE_MOCK } from '../api/index.js';
import { isStaff, PARAMS, ROLES } from '../utils/constants.js';
import { FigmaIcon, Icon } from './icons.jsx';

const NAV = [
  { to: '/', label: 'Tổng quan', end: true },
  { to: '/bieu-do', label: 'Biểu đồ' },
  { to: '/tu-dong-hoa', label: 'Tự động hóa' },
  { to: '/hen-gio', label: 'Hẹn giờ' },
  { to: '/canh-bao', label: 'Cảnh báo' },
  { to: '/lich-su', label: 'Lịch sử' },
  { to: '/thiet-bi', label: 'Thiết bị' },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [summary, setSummary] = useState({ active: 0, unseen: 0 });
  const userRef = useRef(null);

  const loadSummary = () => api.alertSummary().then(setSummary).catch(() => {});
  useEffect(() => {
    loadSummary();
    if (USE_MOCK) return undefined;
    const t = setInterval(loadSummary, PARAMS.POLL_MS);
    return () => clearInterval(t);
  }, []);
  useLiveEvent('alert', loadSummary);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = (e) => userRef.current && !userRef.current.contains(e.target) && setUserOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const name = user?.full_name || user?.username || '';
  const initial = name.trim().split(/\s+/).pop().charAt(0).toUpperCase();
  const nav = isStaff(user) ? [...NAV, { to: '/quan-tri', label: 'Quản trị' }] : NAV;

  return (
    <header className="hdr">
      <div className="hdr-inner">
        <button className="icon-btn hdr-burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Mở menu">
          <Icon name={menuOpen ? 'x' : 'menu'} size={22} />
        </button>
        <Link to="/" className="hdr-brand">
          <span className="hdr-logo">
            <FigmaIcon name="house" size={17} />
          </span>
          <span>SmartHome</span>
        </Link>

        <nav className={`hdr-nav${menuOpen ? ' open' : ''}`} aria-label="Điều hướng chính">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
              {n.to === '/canh-bao' && summary.active > 0 && <span className="hdr-count">{summary.active}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="hdr-right">
          <button className="hdr-bell" onClick={() => navigate('/canh-bao')} aria-label={`Cảnh báo: ${summary.unseen} chưa xem`}>
            <FigmaIcon name="bell" size={40} />
            {summary.unseen > 0 && <span className="hdr-bell-dot" />}
          </button>
          <div className="hdr-user" ref={userRef}>
            <button className="hdr-user-btn" onClick={() => setUserOpen((v) => !v)} aria-expanded={userOpen}>
              <span className="hdr-user-text hide-sm">
                <strong>{name.split(' ').pop()}</strong>
                <span>{ROLES[user?.role]?.label}</span>
              </span>
              <span className="avatar">{initial}</span>
            </button>
            {userOpen && (
              <div className="hdr-menu">
                <Link to="/ca-nhan">
                  <Icon name="user" size={16} /> Thông tin cá nhân
                </Link>
                <Link to="/thiet-bi">
                  <Icon name="home" size={16} /> Vị trí và thiết bị
                </Link>
                {isStaff(user) && (
                  <Link to="/quan-tri">
                    <Icon name="sliders" size={16} /> Quản trị
                  </Link>
                )}
                <button
                  className="danger"
                  onClick={async () => {
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
  );
}
