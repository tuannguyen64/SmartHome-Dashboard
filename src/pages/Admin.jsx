import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { Icon } from '../components/icons.jsx';
import { Badge, Empty, Field, Modal, Pagination, Skeleton, Toggle, useConfirm } from '../components/ui.jsx';
import { ROLES } from '../utils/constants.js';
import { fmtDate } from '../utils/format.js';

// Trang quản lý tài khoản (admin). Thiết bị nằm ở trang Thiết bị dùng chung (DeveloperDevices).
export default function Admin() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quản lý User</h1>
          <p className="page-sub">Mọi tài khoản trong hệ thống: người dùng, kỹ thuật viên và quản trị viên</p>
        </div>
      </div>
      <Users />
    </div>
  );
}

// ------------------------------------------------------------------ tài khoản

function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const act = useAction();
  const [confirm, dialog] = useConfirm();
  const [q, setQ] = useState({ search: '', role: '', status: '', page: 1 });
  const [modal, setModal] = useState(null);
  const list = useApi(() => api.listUsers({ ...q, limit: 10 }), [q.search, q.role, q.status, q.page]);
  const done = () => {
    setModal(null);
    list.reload({ silent: true });
  };

  const remove = async (u) => {
    if (!(await confirm({ title: `Xóa tài khoản "${u.username}"?`, message: 'Tài khoản bị xóa vĩnh viễn và mất quyền truy cập các thiết bị được chia sẻ.', danger: true, confirmText: 'Xóa' }))) return;
    try {
      await act(() => api.deleteUser(u._id));
      toast.success('Đã xóa tài khoản.');
      list.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };
  const setActive = async (u, is_active) => {
    try {
      await act(() => api.updateUser(u._id, { is_active }));
      list.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <div className="filters">
          <input className="input" style={{ width: 260 }} placeholder="Tìm tên, username, email hoặc SĐT" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value, page: 1 })} />
          <select className="select" style={{ width: 170 }} value={q.role} onChange={(e) => setQ({ ...q, role: e.target.value, page: 1 })} aria-label="Lọc theo vai trò">
            <option value="">Tất cả vai trò</option>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="select" style={{ width: 170 }} value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value, page: 1 })} aria-label="Lọc theo trạng thái tài khoản">
            <option value="">Mọi trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          <Icon name="plus" size={17} /> Tạo tài khoản
        </button>
      </div>
      {list.error ? (
        <div className="alert-box alert-box-red">{list.error.message}</div>
      ) : list.loading && !list.data ? (
        <Skeleton height={300} />
      ) : !list.data.items.length ? (
        <Empty title="Không có tài khoản phù hợp" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Họ tên</th>
                  <th className="hide-sm">Liên hệ</th>
                  <th>Thiết bị</th>
                  <th>Vai trò</th>
                  <th className="hide-sm">Telegram</th>
                  <th className="hide-sm">Tạo lúc</th>
                  <th>Hoạt động</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <strong>{u.username}</strong> {u._id === me._id && <Badge>bạn</Badge>}
                    </td>
                    <td>{u.full_name}</td>
                    <td className="hide-sm">{u.email ?? '—'}{u.phone && <span className="admin-log-id">{u.phone}</span>}</td>
                    <td>{u.role === 'user' ? u.device_count ?? 0 : '—'}</td>
                    <td><Badge tone={ROLES[u.role]?.tone}>{ROLES[u.role]?.label ?? u.role}</Badge></td>
                    <td className="hide-sm mono muted">{u.telegram_chat_id ?? '—'}</td>
                    <td className="hide-sm muted">{fmtDate(u.created_at)}</td>
                    <td>
                      <div className="inline" style={{ flexWrap: 'nowrap', gap: 8 }}>
                        <Badge tone={u.is_active !== false ? 'green' : 'red'}>{u.is_active !== false ? 'Hoạt động' : 'Bị khóa'}</Badge>
                        <Toggle on={u.is_active !== false} disabled={u._id === me._id} onChange={(v) => setActive(u, v)} label="Kích hoạt tài khoản" />
                      </div>
                    </td>
                    <td>
                      <div className="inline" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end', gap: 2 }}>
                        <button className="icon-btn" title="Sửa" onClick={() => setModal({ type: 'edit', user: u })}><Icon name="pencil" size={16} /></button>
                        <button className="icon-btn" title="Đặt lại mật khẩu" onClick={() => setModal({ type: 'pwd', user: u })}><Icon name="lock" size={16} /></button>
                        <Link className="icon-btn" to={`/admin/logs?user_id=${encodeURIComponent(u._id)}`} title="Xem lịch sử thao tác"><Icon name="clock" size={16} /></Link>
                        <button className="icon-btn" title="Xóa" disabled={u._id === me._id} onClick={() => remove(u)}><Icon name="trash" size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.data.page} pageSize={list.data.limit} total={list.data.total} onPage={(page) => setQ({ ...q, page })} />
        </>
      )}
      {modal?.type === 'create' && <UserForm onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'edit' && <UserForm user={modal.user} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'pwd' && <ResetPassword user={modal.user} onClose={() => setModal(null)} />}
      {dialog}
    </section>
  );
}

function UserForm({ user, onClose, onDone }) {
  const { user: me } = useAuth();
  const toast = useToast();
  const act = useAction();
  const [f, setF] = useState({ username: '', password: '', full_name: user?.full_name ?? '', email: user?.email ?? '', role: user?.role ?? 'user', phone: user?.phone ?? '', address: user?.address ?? '', telegram_chat_id: user?.telegram_chat_id ?? '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setFields({});
    setError(null);
    try {
      if (user) await act(() => api.updateUser(user._id, { full_name: f.full_name, email: f.email || null, phone: f.phone || null, address: f.address || null, role: f.role, telegram_chat_id: f.telegram_chat_id || null }));
      else await act(() => api.createUser({ ...f, telegram_chat_id: f.telegram_chat_id || null }));
      toast.success(user ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản.');
      onDone();
    } catch (err) {
      setFields(err.details?.fields ?? {});
      setError(err.message);
    }
  };
  return (
    <Modal title={user ? `Sửa tài khoản: ${user.username}` : 'Tạo tài khoản'} onClose={onClose} width={520}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Họ và tên" className="full">
          <input className="input" value={f.full_name} onChange={set('full_name')} autoFocus />
        </Field>
        <Field label="Email" className="full" error={fields.email}>
          <input className="input" type="email" value={f.email} onChange={set('email')} placeholder="ten@example.com" />
        </Field>
        {!user && (
          <>
            <Field label="Tên đăng nhập" error={fields.username}>
              <input className="input" value={f.username} onChange={set('username')} />
            </Field>
            <Field label="Mật khẩu" error={fields.password} hint="Tối thiểu 6 ký tự">
              <input className="input" type="password" value={f.password} onChange={set('password')} />
            </Field>
          </>
        )}
        <Field label="Số điện thoại" error={fields.phone}>
          <input className="input" type="tel" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Vai trò">
          <select className="select" value={f.role} onChange={set('role')} disabled={user?._id === me?._id}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Địa chỉ nhà" className="full">
          <input className="input" value={f.address} onChange={set('address')} placeholder="Dùng cho tài khoản người dùng" />
        </Field>
        <Field label="Telegram chat ID" className="full">
          <input className="input" value={f.telegram_chat_id} onChange={set('telegram_chat_id')} />
        </Field>
        {error && <div className="alert-box alert-box-red full">{error}</div>}
        <div className="modal-foot full" style={{ marginTop: 4 }}>
          <button type="button" className="btn btn-soft" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary">Lưu</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ user, onClose }) {
  const toast = useToast();
  const act = useAction();
  const [pw, setPw] = useState('');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await act(() => api.resetUserPassword(user._id, pw));
      toast.success(`Đã đặt lại mật khẩu cho ${user.username}.`);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal title={`Đặt lại mật khẩu: ${user.username}`} onClose={onClose} width={440}>
      <form className="stack" onSubmit={submit}>
        <Field label="Mật khẩu mới" hint="Tối thiểu 6 ký tự">
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </Field>
        {error && <div className="alert-box alert-box-red">{error}</div>}
        <div className="modal-foot" style={{ marginTop: 4 }}>
          <button type="button" className="btn btn-soft" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={pw.length < 6}>Đặt lại</button>
        </div>
      </form>
    </Modal>
  );
}

