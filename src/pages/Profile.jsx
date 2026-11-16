import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { Icon } from '../components/icons.jsx';
import { Badge, Field, Spinner } from '../components/ui.jsx';
import { ROLES } from '../utils/constants.js';
import { fmtDate } from '../utils/format.js';

// Hồ sơ người dùng (collection users: username, full_name, role, telegram_chat_id) + đổi mật khẩu
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pwdRef = useRef(null);
  const tgRef = useRef(null);
  const stats = useApi(async () => {
    if (user?.role !== 'user') return null;
    const [devices, rules, schedules] = await Promise.all([
      api.myDevices(),
      api.listRules().catch(() => []),
      api.listSchedules().catch(() => []),
    ]);
    return { devices: devices.length, rules: rules.length, schedules: schedules.length };
  }, []);
  const name = user?.full_name || user?.username || '';
  const staff = user?.role === 'admin' || user?.role === 'developer';
  const scroll = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Thông tin cá nhân</h1>
          <p className="page-sub">Quản lý hồ sơ, bảo mật tài khoản và kênh nhận cảnh báo</p>
        </div>
      </div>

      <div className="split" style={{ '--split-cols': 'minmax(0, 340px) minmax(0, 1fr)' }}>
        <div className="stack" style={{ gap: 'var(--gap)' }}>
          <section className="card profile-card">
            <div className="profile-avatar">{name.trim().split(/\s+/).pop().charAt(0).toUpperCase()}</div>
            <div className="profile-name">{name}</div>
            <div className="muted">@{user?.username}</div>
            {staff ? (
              <div style={{ marginTop: 8 }}>
                <Badge tone={ROLES[user?.role]?.tone}>{ROLES[user?.role]?.label}</Badge>
              </div>
            ) : (
              <div className="profile-stats">
                <div><strong>{stats.data?.devices ?? '–'}</strong><span>Thiết bị</span></div>
                <div><strong>{stats.data?.rules ?? '–'}</strong><span>Quy tắc</span></div>
                <div><strong>{stats.data?.schedules ?? '–'}</strong><span>Lịch hẹn</span></div>
              </div>
            )}
          </section>
          <nav className="card side-menu">
            <button className="active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <Icon name="user" size={18} /> Hồ sơ
            </button>
            <button onClick={() => scroll(pwdRef)}>
              <Icon name="lock" size={18} /> Đổi mật khẩu
            </button>
            <button onClick={() => scroll(tgRef)}>
              <Icon name="send" size={18} /> Thông báo Telegram
            </button>
            <button className="danger" onClick={async () => { await logout(); navigate('/dang-nhap'); }}>
              <Icon name="logout" size={18} /> Đăng xuất
            </button>
          </nav>
        </div>

        <div className="stack" style={{ gap: 'var(--gap)' }}>
          <BasicInfo tgRef={tgRef} />
          <div ref={pwdRef}>
            <ChangePassword />
          </div>
        </div>
      </div>
    </div>
  );
}

function BasicInfo({ tgRef }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const act = useAction();
  const [editing, setEditing] = useState(false);
  const staff = user.role === 'admin' || user.role === 'developer';
  const initial = () => ({
    full_name: user.full_name ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    address: user.address ?? '',
    telegram_chat_id: user.telegram_chat_id ?? '',
  });
  const [f, setF] = useState(initial);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setFields({});
    try {
      const body = {
        full_name: f.full_name,
        email: f.email.trim() || null,
        phone: f.phone.trim() || null,
        telegram_chat_id: f.telegram_chat_id || null,
        ...(staff ? {} : { address: f.address.trim() || null }),
      };
      setUser(await act(() => api.updateMe(body)));
      setEditing(false);
      toast.success('Đã cập nhật hồ sơ.');
    } catch (e) {
      setFields(e.details?.fields ?? {});
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Thông tin cơ bản</h2>
        {editing ? (
          <div className="inline">
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setFields({}); setF(initial()); }}>Hủy</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>Lưu</button>
          </div>
        ) : (
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
            <Icon name="pencil" size={15} /> Chỉnh sửa
          </button>
        )}
      </div>
      <div className="form-grid">
        <Field label="Họ và tên">
          <input className="input" value={editing ? f.full_name : user.full_name ?? ''} disabled={!editing} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </Field>
        <Field label="Tên đăng nhập">
          <input className="input" value={user.username} disabled />
        </Field>
        <Field label="Email" error={fields.email}>
          <input className="input" type="email" value={editing ? f.email : user.email ?? ''} placeholder="Chưa khai báo" disabled={!editing} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Số điện thoại" error={fields.phone}>
          <input className="input" type="tel" value={editing ? f.phone : user.phone ?? ''} placeholder="Chưa khai báo" disabled={!editing} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        {staff ? (
          <>
            <Field label="Vai trò">
              <input className="input" value={ROLES[user.role]?.label ?? user.role} disabled />
            </Field>
            <Field label="Ngày tạo tài khoản">
              <input className="input" value={fmtDate(user.created_at)} disabled />
            </Field>
          </>
        ) : (
          <Field label="Địa chỉ nhà" className="full" hint="Kỹ thuật viên dùng địa chỉ này khi đến lắp đặt hoặc bảo trì thiết bị.">
            <input className="input" value={editing ? f.address : user.address ?? ''} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" disabled={!editing} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
        )}
        <div className="full" ref={tgRef}>
          <Field label="Telegram chat ID" hint="Nhắn /start cho bot của hệ thống trên Telegram để lấy chat ID. Cần có để nhận cảnh báo qua Telegram.">
            <input className="input mono" value={editing ? f.telegram_chat_id : user.telegram_chat_id ?? ''} placeholder="Chưa khai báo" disabled={!editing} onChange={(e) => setF({ ...f, telegram_chat_id: e.target.value.trim() })} />
          </Field>
        </div>
      </div>
    </section>
  );
}

function ChangePassword() {
  const toast = useToast();
  const act = useAction();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) return setFields({ confirm: 'Mật khẩu nhập lại không khớp' });
    setBusy(true);
    setFields({});
    try {
      await act(() => api.changePassword(form.current_password, form.new_password));
      setForm({ current_password: '', new_password: '', confirm: '' });
      toast.success('Đã đổi mật khẩu.');
    } catch (err) {
      setFields(err.details?.fields ?? {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const input = (k, label, ac) => (
    <Field label={label} error={fields[k]}>
      <input className={`input${fields[k] ? ' invalid' : ''}`} type="password" autoComplete={ac} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
    </Field>
  );
  return (
    <section className="card">
      <form onSubmit={submit}>
        <div className="card-head">
          <h2 className="card-title">Đổi mật khẩu</h2>
        </div>
        <div className="grid grid-3" style={{ gap: 16 }}>
          {input('current_password', 'Mật khẩu hiện tại', 'current-password')}
          {input('new_password', 'Mật khẩu mới', 'new-password')}
          {input('confirm', 'Nhập lại mật khẩu mới', 'new-password')}
        </div>
        <div className="inline" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <span className="small muted">Tối thiểu 6 ký tự.</span>
          <button className="btn btn-primary" disabled={busy || !form.current_password || !form.new_password}>
            {busy && <Spinner />} Cập nhật mật khẩu
          </button>
        </div>
      </form>
    </section>
  );
}
