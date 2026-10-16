import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { FigmaIcon } from '../components/icons.jsx';
import { Spinner } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';

// Đăng ký tài khoản người dùng (role mặc định "user")
export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', username: '', password: '', confirm: '', telegram_chat_id: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setFields({ confirm: 'Mật khẩu nhập lại không khớp' });
    setBusy(true);
    try {
      const { confirm, ...body } = form;
      await register({ ...body, telegram_chat_id: body.telegram_chat_id || undefined });
      navigate('/', { replace: true });
    } catch (err) {
      setFields(err.details?.fields ?? {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = (key, label, props = {}) => (
    <label className="field">
      <span className="label">{label}</span>
      <input className={`input${fields[key] ? ' invalid' : ''}`} value={form[key]} onChange={set(key)} {...props} />
      {fields[key] && <span className="field-error">{fields[key]}</span>}
    </label>
  );

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate>
        <h2>Đăng ký</h2>
        <p className="lead">Tạo tài khoản để quản lý ngôi nhà của bạn.</p>
        <div className="auth-fields">
          {input('full_name', 'Họ và tên', { autoComplete: 'name' })}
          {input('username', 'Tên đăng nhập (tối thiểu 3 ký tự)', { autoComplete: 'username' })}
          {input('password', 'Mật khẩu (tối thiểu 6 ký tự)', { type: 'password', autoComplete: 'new-password' })}
          {input('confirm', 'Nhập lại mật khẩu', { type: 'password', autoComplete: 'new-password' })}
          {input('telegram_chat_id', 'Telegram chat ID (tùy chọn, để nhận cảnh báo)')}
        </div>
        <div className="auth-submit">
          <button className="btn" type="submit" disabled={busy}>
            {busy && <Spinner />} Tạo tài khoản
          </button>
        </div>
        <p className="auth-switch">
          Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link>
        </p>
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
