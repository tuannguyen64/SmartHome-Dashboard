import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { USE_MOCK } from '../api/index.js';
import { FigmaIcon } from '../components/icons.jsx';
import { Spinner } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';

// UC01-1 Đăng nhập (users.username + mật khẩu)
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Nhập tên đăng nhập và mật khẩu.');
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, remember);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate>
        <h2>Đăng nhập</h2>
        <p className="lead">Chào mừng trở lại! Nhập thông tin để tiếp tục.</p>
        <div className="auth-fields">
          <label className="field">
            <span className="label">Tên đăng nhập</span>
            <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Mật khẩu</span>
            <div className="auth-pass">
              <input
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                <FigmaIcon name="eye" width={12} height={7} style={{ opacity: show ? 1 : 0.6 }} />
              </button>
            </div>
          </label>
        </div>
        <div className="auth-options">
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Ghi nhớ đăng nhập
          </label>
        </div>
        <div className="auth-submit">
          <button className="btn" type="submit" disabled={busy}>
            {busy && <Spinner />} Đăng nhập
          </button>
        </div>
        <p className="auth-switch">
          Chưa có tài khoản? <Link to="/dang-ky">Đăng ký</Link>
        </p>
        {USE_MOCK && <p className="small muted" style={{ textAlign: 'center', marginBottom: 12 }}>Chế độ dữ liệu giả lập · tài khoản mẫu: admin, dev, tuan (xem README)</p>}
        {error && (
          <div className="auth-error" role="alert">
            <FigmaIcon name="warning" size={12} />
            {error}
          </div>
        )}
      </form>
    </AuthShell>
  );
}
