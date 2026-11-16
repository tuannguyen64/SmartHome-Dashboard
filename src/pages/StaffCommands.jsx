import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { Badge, Empty, Field, Pagination, Skeleton } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { fmtDateTime } from '../utils/format.js';
import './admin.css';

const PAGE_SIZE = 20;
const SOURCES = {
  dashboard: { label: 'Bảng điều khiển', tone: 'blue' },
  automation: { label: 'Tự động', tone: 'amber' },
  schedule: { label: 'Hẹn giờ', tone: 'green' },
  voice: { label: 'Giọng nói', tone: 'gray' },
  button: { label: 'Nút trên bo', tone: 'gray' },
};
const dateBoundary = (date, end = false) => (date ? new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}+07:00`).toISOString() : undefined);
const actionText = (payload, unit) => (payload?.mode === 'on' ? `Bật${payload.val != null ? ` · ${payload.val}${unit ? ` ${unit}` : ''}` : ''}` : 'Tắt');

// Lịch sử lệnh của mọi thiết bị đã tạo (admin, developer): ai / cái gì đã điều khiển thiết bị, lúc nào
export default function StaffCommands() {
  const { user } = useAuth();
  const base = user?.role === 'developer' ? '/developer' : '/admin';
  const [filters, setFilters] = useState({ search: '', device_id: '', source: '', from: '', to: '' });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((current) => (current.search === searchInput ? current : { ...current, search: searchInput }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const query = { ...filters, from: dateBoundary(filters.from), to: dateBoundary(filters.to, true), page, limit: PAGE_SIZE };
  const list = useApi(() => api.listStaffCommands(query), [JSON.stringify(query)], { poll: 15000 });
  const setFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const hasFilters = Object.values(filters).some(Boolean) || Boolean(searchInput);

  return (
    <div className="page admin-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Lịch sử lệnh</h1>
          <p className="page-sub">Lệnh điều khiển đã gửi tới các thiết bị đã tạo: từ người dùng, quy tắc tự động, hẹn giờ hoặc nút trên bo</p>
        </div>
      </div>

      <section className="card admin-log-filters">
        <div className="admin-log-filter-grid admin-command-filter-grid">
          <Field label="Tìm kiếm" className="admin-log-search">
            <input className="input" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tên thiết bị hoặc người điều khiển..." />
          </Field>
          <Field label="Thiết bị">
            <select className="select" value={filters.device_id} onChange={(e) => setFilter('device_id', e.target.value)}>
              <option value="">Tất cả thiết bị</option>
              {(list.data?.filters?.devices ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Nguồn lệnh">
            <select className="select" value={filters.source} onChange={(e) => setFilter('source', e.target.value)}>
              <option value="">Mọi nguồn</option>
              {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Từ ngày">
            <input className="input" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input className="input" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </Field>
          <button
            className="btn btn-ghost btn-sm admin-log-clear"
            type="button"
            disabled={!hasFilters}
            onClick={() => { setPage(1); setSearchInput(''); setFilters({ search: '', device_id: '', source: '', from: '', to: '' }); }}
          >
            Xóa bộ lọc
          </button>
        </div>
      </section>

      {list.error && <div className="alert-box alert-box-red" role="alert">{list.error.message}</div>}
      <section className="card admin-log-card">
        {list.loading && !list.data ? <Skeleton height={380} /> : !list.data?.items.length ? (
          <Empty title={hasFilters ? 'Không có lệnh phù hợp' : 'Chưa có lệnh nào'}>Lệnh điều khiển thiết bị sẽ xuất hiện ở đây.</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Thời gian</th><th>Thiết bị</th><th>Linh kiện</th><th>Lệnh</th><th>Nguồn</th><th>Người điều khiển</th></tr>
                </thead>
                <tbody>
                  {list.data.items.map((c) => (
                    <tr key={c._id}>
                      <td className="nowrap muted">{fmtDateTime(c.sent_at)}</td>
                      <td>
                        <Link to={`${base}/devices/${c.device_id}`}><strong>{c.device_name}</strong></Link>
                        <span className="admin-log-id">{c.owner_name ? `Chủ: ${c.owner_name}` : 'Chưa có chủ'}</span>
                      </td>
                      <td>{c.component}</td>
                      <td>{actionText(c.payload, c.unit)}</td>
                      <td><Badge tone={SOURCES[c.source]?.tone ?? 'gray'}>{SOURCES[c.source]?.label ?? c.source}</Badge></td>
                      <td>{c.issued_by ? <>{c.issued_by.full_name}<span className="admin-log-id">@{c.issued_by.username}</span></> : <span className="muted">Hệ thống</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.data.page} pageSize={list.data.limit} total={list.data.total} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
