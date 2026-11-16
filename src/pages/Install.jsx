import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { Badge, Empty, Field, Skeleton } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import './developer.css';

const NEW_ROOM = '__new__';
const EMPTY = { registration_code: '', place_id: '', new_room_name: '', device_name: '' };

// Kỹ thuật viên tới nhà khách: chọn khách hàng + phòng, nhập mã in trên bo → thiết bị thuộc về khách
export default function Install() {
  const { user } = useAuth();
  const base = user?.role === 'developer' ? '/developer' : '/admin';
  const toast = useToast();
  const act = useAction();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [customer, setCustomer] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const customers = useApi(() => api.listCustomers({ search: query }), [query]);
  const places = useApi(() => (customer ? api.customerPlaces(customer._id) : Promise.resolve([])), [customer?._id]);
  const placeList = places.data ?? [];

  // Khách chưa có phòng nào → mặc định tạo phòng mới
  useEffect(() => {
    if (customer && !places.loading && !placeList.length) setForm((f) => ({ ...f, place_id: NEW_ROOM }));
  }, [customer, places.loading, placeList.length]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const pick = (c) => {
    setCustomer(c);
    setForm(EMPTY);
    setFields({});
  };

  const submit = async (event) => {
    event.preventDefault();
    setFields({});
    if (!customer) { setFields({ customer_id: 'Chọn khách hàng' }); return; }
    setSaving(true);
    try {
      const newRoom = form.place_id === NEW_ROOM;
      const device = await act(() => api.installDevice({
        registration_code: form.registration_code.trim(),
        customer_id: customer._id,
        place_id: newRoom ? null : form.place_id || null,
        new_room_name: newRoom ? form.new_room_name.trim() : '',
        device_name: form.device_name.trim(),
      }));
      toast.success(`Đã lắp "${device.device_name}" cho ${customer.full_name}.`);
      setDone((list) => [{ ...device, customer: customer.full_name }, ...list]);
      setForm(EMPTY);
      places.reload({ silent: true });
      customers.reload({ silent: true });
    } catch (err) {
      setFields(err.details?.fields ?? {});
      toast.error(err.message || 'Không lắp đặt được thiết bị.');
    } finally {
      setSaving(false);
    }
  };

  const list = customers.data?.items ?? [];

  return (
    <div className="page developer-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Lắp đặt tại nhà khách</h1>
          <p className="page-sub">Chọn khách hàng và phòng, nhập mã đăng ký in trên bo mạch. Thiết bị sẽ thuộc về tài khoản của khách và do bạn phụ trách.</p>
        </div>
      </div>

      <div className="install-grid">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{query ? 'Kết quả tìm kiếm' : user?.role === 'developer' ? 'Khách hàng của tôi' : 'Khách hàng'}</h2>
            <Badge tone="gray">{list.length}</Badge>
          </div>
          <input
            className="input"
            type="search"
            placeholder="Tìm theo tên, tên đăng nhập, số điện thoại, địa chỉ…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {customers.error ? <div className="alert-box alert-box-red" style={{ marginTop: 12 }}>{customers.error.message}</div>
            : customers.loading && !customers.data ? <Skeleton height={160} style={{ marginTop: 12 }} />
              : !list.length ? (
                <Empty title={query ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng'}>
                  {query ? 'Kiểm tra lại từ khóa. Khách cần tự tạo tài khoản trước khi lắp.' : 'Tìm khách theo tên hoặc số điện thoại để lắp thiết bị đầu tiên.'}
                </Empty>
              ) : (
                <ul className="install-customer-list">
                  {list.map((c) => (
                    <li key={c._id}>
                      <button type="button" className={customer?._id === c._id ? 'active' : ''} onClick={() => pick(c)} disabled={!c.is_active}>
                        <span className="install-customer-name">
                          <strong>{c.full_name}</strong> <span className="muted">@{c.username}</span>
                          {!c.is_active && <Badge tone="red">Bị khóa</Badge>}
                        </span>
                        <span className="small muted">{[c.phone, c.address].filter(Boolean).join(' · ') || 'Chưa có SĐT / địa chỉ'}</span>
                        <span className="small">{c.installed_by_me ? `Bạn đã lắp ${c.installed_by_me} thiết bị` : 'Chưa lắp thiết bị nào'}{c.device_count > c.installed_by_me ? ` · tổng ${c.device_count}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </section>

        <section className="card">
          <div className="card-head"><h2 className="card-title">Thông tin lắp đặt</h2></div>
          <form className="install-form" onSubmit={submit} noValidate>
            <Field label="Khách hàng" error={fields.customer_id}>
              <div className="install-selected">
                {customer ? <><strong>{customer.full_name}</strong><span className="muted">{customer.address || customer.phone || `@${customer.username}`}</span></> : <span className="muted">Chọn khách ở danh sách bên trái</span>}
              </div>
            </Field>
            <Field label="Vị trí lắp" error={fields.place_id}>
              <select className="input" value={form.place_id} onChange={set('place_id')} disabled={!customer || places.loading}>
                <option value="">— Chọn phòng —</option>
                {placeList.map((pl) => <option key={pl._id} value={pl._id}>{pl.path}</option>)}
                <option value={NEW_ROOM}>+ Tạo phòng mới…</option>
              </select>
            </Field>
            {form.place_id === NEW_ROOM && (
              <Field label="Tên phòng mới" hint="Tạo trong nhà của khách (tự tạo nhà nếu khách chưa có).">
                <input className="input" value={form.new_room_name} onChange={set('new_room_name')} placeholder="VD: Phòng khách" />
              </Field>
            )}
            <Field label="Mã đăng ký" error={fields.registration_code} hint="Mã in trên bo mạch / tem thiết bị.">
              <input className="input install-code" value={form.registration_code} onChange={set('registration_code')} placeholder="VD: AB12CD34" autoComplete="off" />
            </Field>
            <Field label="Tên thiết bị (tuỳ chọn)" hint="Để trống sẽ giữ tên mặc định của mẫu.">
              <input className="input" value={form.device_name} onChange={set('device_name')} placeholder="VD: Quạt phòng khách" />
            </Field>
            <button className="btn btn-primary" type="submit" disabled={saving || !customer}>
              <Icon name="plus" size={16} /> {saving ? 'Đang lắp…' : 'Lắp đặt cho khách'}
            </button>
          </form>

          {done.length > 0 && (
            <div className="install-done">
              <h3>Vừa lắp trong phiên này</h3>
              <ul>
                {done.map((d) => (
                  <li key={d._id}>
                    <Icon name="check" size={14} /> <Link to={`${base}/devices/${d._id}`}>{d.device_name}</Link>
                    <span className="muted"> · {d.customer}{d.place_path ? ` · ${d.place_path}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
