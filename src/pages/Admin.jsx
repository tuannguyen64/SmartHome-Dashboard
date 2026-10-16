import { useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { Icon } from '../components/icons.jsx';
import { Badge, Empty, Field, Modal, Pagination, Segmented, Skeleton, Toggle, useConfirm } from '../components/ui.jsx';
import { ROLES } from '../utils/constants.js';
import { downloadText, fmtDate, timeAgo, toCsv } from '../utils/format.js';

// Trang quản trị: tài khoản (admin) + sản xuất thiết bị / mã đăng ký (admin, developer)
export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState(user.role === 'admin' ? 'users' : 'devices');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quản trị</h1>
          <p className="page-sub">Quản lý tài khoản, phân quyền và thiết bị trong hệ thống</p>
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[...(user.role === 'admin' ? [{ value: 'users', label: 'Tài khoản' }] : []), { value: 'devices', label: 'Thiết bị & mã đăng ký' }]}
        />
      </div>
      {tab === 'users' ? <Users /> : <Devices />}
    </div>
  );
}

// ------------------------------------------------------------------ tài khoản

function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const act = useAction();
  const [confirm, dialog] = useConfirm();
  const [q, setQ] = useState({ search: '', role: '', page: 1 });
  const [modal, setModal] = useState(null);
  const list = useApi(() => api.listUsers({ ...q, limit: 10 }), [q.search, q.role, q.page]);
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
          <input className="input" style={{ width: 260 }} placeholder="Tìm theo tên đăng nhập / họ tên" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value, page: 1 })} />
          <select className="select" style={{ width: 170 }} value={q.role} onChange={(e) => setQ({ ...q, role: e.target.value, page: 1 })}>
            <option value="">Tất cả vai trò</option>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
                    <td><Badge tone={ROLES[u.role]?.tone}>{ROLES[u.role]?.label ?? u.role}</Badge></td>
                    <td className="hide-sm mono muted">{u.telegram_chat_id ?? '—'}</td>
                    <td className="hide-sm muted">{fmtDate(u.created_at)}</td>
                    <td>
                      <Toggle on={u.is_active !== false} disabled={u._id === me._id} onChange={(v) => setActive(u, v)} label="Kích hoạt tài khoản" />
                    </td>
                    <td>
                      <div className="inline" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end', gap: 2 }}>
                        <button className="icon-btn" title="Sửa" onClick={() => setModal({ type: 'edit', user: u })}><Icon name="pencil" size={16} /></button>
                        <button className="icon-btn" title="Đặt lại mật khẩu" onClick={() => setModal({ type: 'pwd', user: u })}><Icon name="lock" size={16} /></button>
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
  const toast = useToast();
  const act = useAction();
  const [f, setF] = useState({ username: '', password: '', full_name: user?.full_name ?? '', role: user?.role ?? 'user', telegram_chat_id: user?.telegram_chat_id ?? '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setFields({});
    setError(null);
    try {
      if (user) await act(() => api.updateUser(user._id, { full_name: f.full_name, role: f.role, telegram_chat_id: f.telegram_chat_id || null }));
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
        <Field label="Vai trò">
          <select className="select" value={f.role} onChange={set('role')}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Telegram chat ID">
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

// ------------------------------------------------------------------ thiết bị (sản xuất + mã đăng ký)

function Devices() {
  const toast = useToast();
  const act = useAction();
  const [q, setQ] = useState({ search: '', registered: '', page: 1 });
  const models = useApi(() => api.listDeviceModels(), []);
  const list = useApi(() => api.listDevices({ ...q, limit: 10 }), [q.search, q.registered, q.page]);
  const [clone, setClone] = useState({ device_model_id: '', quantity: 1 });
  const [created, setCreated] = useState(null);
  const modelName = (id) => (models.data ?? []).find((m) => m._id === id)?.name ?? '—';

  const submitClone = async (e) => {
    e.preventDefault();
    try {
      const res = await act(() => api.cloneDevices({ device_model_id: clone.device_model_id || models.data?.[0]?._id, quantity: Number(clone.quantity) }));
      setCreated(res);
      list.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <form className="card" onSubmit={submitClone}>
        <div className="card-head">
          <div>
            <h2 className="card-title">Nhân bản thiết bị từ mẫu</h2>
            <p className="card-sub">Mỗi bản có mã đăng ký riêng để người dùng nhận thiết bị</p>
          </div>
        </div>
        <div className="inline" style={{ alignItems: 'flex-end' }}>
          <Field label="Mẫu thiết bị">
            <select className="select" style={{ minWidth: 220 }} value={clone.device_model_id} onChange={(e) => setClone({ ...clone, device_model_id: e.target.value })}>
              {(models.data ?? []).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Số lượng (1–50)">
            <input className="input" style={{ width: 120 }} type="number" required min={1} max={50} value={clone.quantity} onChange={(e) => setClone({ ...clone, quantity: e.target.value })} />
          </Field>
          <button className="btn btn-primary" disabled={!models.data?.length}>Nhân bản</button>
        </div>
      </form>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Tất cả thiết bị</h2>
          <div className="filters">
            <input className="input" style={{ width: 220 }} placeholder="Tìm theo tên" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value, page: 1 })} />
            <select className="select" style={{ width: 170 }} value={q.registered} onChange={(e) => setQ({ ...q, registered: e.target.value, page: 1 })}>
              <option value="">Tất cả</option>
              <option value="false">Chưa đăng ký</option>
              <option value="true">Đã đăng ký</option>
            </select>
          </div>
        </div>
        {list.error ? (
          <div className="alert-box alert-box-red">{list.error.message}</div>
        ) : list.loading && !list.data ? (
          <Skeleton height={300} />
        ) : !list.data.items.length ? (
          <Empty title="Chưa có thiết bị" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thiết bị</th>
                    <th className="hide-sm">Mẫu</th>
                    <th>Đăng ký</th>
                    <th>Mã đăng ký</th>
                    <th className="hide-sm">Tin cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((d) => (
                    <tr key={d._id}>
                      <td><strong>{d.device_name}</strong></td>
                      <td className="hide-sm">{modelName(d.device_model_id)}</td>
                      <td>{d.owner_id ? <Badge tone="green">Đã đăng ký</Badge> : <Badge tone="amber">Chưa đăng ký</Badge>}</td>
                      <td>{d.registration_code ? <span className="code-chip">{d.registration_code}</span> : '—'}</td>
                      <td className="hide-sm muted">{d.owner_id ? timeAgo(d.last_seen) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.data.page} pageSize={list.data.limit} total={list.data.total} onPage={(page) => setQ({ ...q, page })} />
          </>
        )}
      </section>

      {created && (
        <Modal
          title={`Đã tạo ${created.length} thiết bị`}
          onClose={() => setCreated(null)}
          footer={
            <button
              className="btn btn-outline"
              onClick={() => downloadText('ma-dang-ky.csv', toCsv([['Tên thiết bị', 'Mã đăng ký'], ...created.map((d) => [d.device_name, d.registration_code])]))}
            >
              <Icon name="download" size={16} /> Tải CSV
            </button>
          }
        >
          <p className="muted" style={{ marginBottom: 12 }}>Dán mã lên bo hoặc gửi cho người dùng để họ đăng ký thiết bị.</p>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {created.map((d) => (
                  <tr key={d._id}>
                    <td>{d.device_name}</td>
                    <td><span className="code-chip">{d.registration_code}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}
