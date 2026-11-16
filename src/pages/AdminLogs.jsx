import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { Badge, Empty, Field, Pagination, Skeleton } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { PARAMS } from '../utils/constants.js';
import { fmtDateTime, toCsv, downloadText } from '../utils/format.js';
import './admin.css';

const PAGE_SIZE = 15;
const EMPTY_FILTERS = { search: '', user_id: '', level: '', from: '', to: '' };
const dateBoundary = (date, end = false) => date ? new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}+07:00`).toISOString() : undefined;
const LEVELS = {
  info: { label: 'Info', tone: 'blue' },
  warn: { label: 'Warn', tone: 'amber' },
  error: { label: 'Error', tone: 'red' },
};
const ACTIONS = {
  'auth.login.success': 'Đăng nhập thành công',
  'auth.login.failed': 'Đăng nhập thất bại',
  'auth.login.blocked': 'Đăng nhập bị chặn',
  'auth.register': 'Đăng ký tài khoản',
  'user.created': 'Tạo tài khoản',
  'user.updated': 'Cập nhật tài khoản',
  'user.profile.updated': 'Cập nhật hồ sơ',
  'user.password_changed': 'Đổi mật khẩu',
  'user.deleted': 'Xóa tài khoản',
  'user.password_reset': 'Đặt lại mật khẩu',
  'config.rule.created': 'Tạo quy tắc cảnh báo',
  'config.rule.updated': 'Cập nhật quy tắc cảnh báo',
  'config.rule.deleted': 'Xóa quy tắc cảnh báo',
  'config.schedule.created': 'Tạo lịch',
  'config.schedule.updated': 'Cập nhật lịch',
  'config.schedule.deleted': 'Xóa lịch',
  'system.settings.updated': 'Cập nhật cấu hình hệ thống',
  'system.alert_channel.tested': 'Kiểm tra kênh cảnh báo',
  'device.provisioned': 'Cấp mã thiết bị',
  'alert.acknowledged': 'Xác nhận cảnh báo',
  'hardware.command': 'Lệnh phần cứng',
};

export default function AdminLogs() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, user_id: searchParams.get('user_id') ?? '' }));
  const [page, setPage] = useState(1);
  // Ô tìm kiếm giữ chữ đang gõ; chỉ lọc sau khi ngừng gõ 300ms để bảng không tải lại theo từng ký tự
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((current) => (current.search === searchInput ? current : { ...current, search: searchInput }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const query = {
    ...filters,
    from: dateBoundary(filters.from),
    to: dateBoundary(filters.to, true),
    page,
    limit: PAGE_SIZE,
  };
  const logs = useApi(() => api.listAdminLogs(query), [JSON.stringify(query)], { poll: PARAMS.POLL_MS });
  useLiveEvent(['command', 'alert', 'device'], () => logs.reload({ silent: true }));

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const hasFilters = Object.values(filters).some(Boolean) || Boolean(searchInput);
  const filteredUser = filters.user_id ? (logs.data?.filters.users ?? []).find((u) => u.id === filters.user_id) : null;
  const clearFilters = () => {
    setPage(1);
    setSearchInput('');
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div className="page admin-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Nhật ký Hệ thống</h1>
          <p className="page-sub">Audit đăng nhập, thay đổi cấu hình và hoạt động thiết bị trên toàn hệ thống</p>
        </div>
        <button
          className="btn btn-outline"
          type="button"
          disabled={!logs.data?.items.length}
          onClick={() => {
            const rows = [
              ['Thời gian', 'Mức độ', 'Người dùng', 'User ID', 'Thiết bị', 'Device ID', 'Sự kiện', 'Chi tiết', 'Latency (ms)'],
              ...logs.data.items.map((item) => [
                fmtDateTime(item.created_at),
                LEVELS[item.level]?.label ?? item.level,
                item.username ?? 'Hệ thống',
                item.user_id ?? '',
                item.device_name ?? '',
                item.device_id ?? '',
                ACTIONS[item.action] ?? item.action,
                item.details,
                item.latency_ms ?? '',
              ]),
            ];
            downloadText('smarthome-audit-log.csv', toCsv(rows));
          }}
        >
          <Icon name="download" size={17} />           Xuất trang CSV
        </button>
      </div>

      <section className="card admin-log-filters">
        <div className="admin-log-filter-grid">
          <Field label="Tìm kiếm" className="admin-log-search">
            <input className="input" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tên user, thiết bị, sự kiện..." />
          </Field>
          <Field label="Mức độ">
            <select className="select" value={filters.level} onChange={(e) => setFilter('level', e.target.value)}>
              <option value="">Tất cả mức độ</option>
              {Object.entries(LEVELS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Từ ngày">
            <input className="input" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input className="input" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </Field>
          <button className="btn btn-ghost btn-sm admin-log-clear" type="button" disabled={!hasFilters} onClick={clearFilters}>Xóa bộ lọc</button>
        </div>
        {filters.user_id && (
          <p className="admin-log-user-filter">
            Đang xem nhật ký của <strong>{filteredUser ? `${filteredUser.name} (@${filteredUser.username})` : 'một người dùng'}</strong>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setFilter('user_id', '')}>Xem tất cả</button>
          </p>
        )}
        {filters.from && filters.to && filters.from > filters.to && <p className="field-error">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      </section>

      {logs.error && <div className="alert-box alert-box-red" role="alert">{logs.error.message}</div>}
      <section className="card admin-log-card">
        {logs.loading && !logs.data ? <Skeleton height={380} /> : !logs.data?.items.length ? (
          <Empty title={hasFilters ? 'Không có nhật ký phù hợp' : 'Chưa có nhật ký'}>Các thao tác mới sẽ được ghi nhận tại đây.</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table admin-log-table">
                <thead>
                  <tr><th>Thời gian</th><th>Mức độ</th><th>Người dùng</th><th>Thiết bị</th><th>Sự kiện</th><th>Độ trễ</th></tr>
                </thead>
                <tbody>
                  {logs.data.items.map((item) => (
                    <tr key={item._id}>
                      <td className="nowrap mono">{fmtDateTime(item.created_at)}</td>
                      <td><Badge tone={LEVELS[item.level]?.tone ?? 'gray'}>{LEVELS[item.level]?.label ?? item.level}</Badge></td>
                      <td>
                        <strong>{item.username ?? 'Hệ thống'}</strong>
                        {item.user_id && <span className="admin-log-id" title={item.user_id}>ID {item.user_id.slice(-8)}</span>}
                      </td>
                      <td>
                        {item.device_name ?? '—'}
                        {item.device_id && <span className="admin-log-id" title={item.device_id}>ID {item.device_id.slice(-8)}</span>}
                      </td>
                      <td>
                        <strong>{ACTIONS[item.action] ?? item.action}</strong>
                        <span className="admin-log-details">{item.details}</span>
                      </td>
                      <td className="mono">{item.latency_ms == null ? '—' : `${item.latency_ms} ms`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={logs.data.page} pageSize={logs.data.limit} total={logs.data.total} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
