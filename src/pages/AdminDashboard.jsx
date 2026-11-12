import { useState } from 'react';
import { useAdminDashboard } from '../hooks/useAdminDashboard.js';
import { Badge, Empty, Skeleton } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtTime } from '../utils/format.js';
import './admin.css';

const METRICS = [
  { key: 'users', label: 'Tổng số User', icon: 'user', color: 'blue' },
  { key: 'devices', label: 'Tổng số Thiết bị', icon: 'home', color: 'green' },
  { key: 'alerts', label: 'Cảnh báo hôm nay', icon: 'alert', color: 'amber' },
  { key: 'server', label: 'Sức khỏe máy chủ', icon: 'refresh', color: 'purple' },
];

const DEV_FILTERS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'devices', label: 'Thiết bị' },
  { key: 'alerts', label: 'Cảnh báo' },
  { key: 'controls', label: 'Điều khiển' },
];

function MetricCard({ metric, data }) {
  const value = metric.key === 'users'
    ? data.users.total.toLocaleString('vi-VN')
    : metric.key === 'devices'
      ? data.devices.total.toLocaleString('vi-VN')
      : metric.key === 'alerts'
        ? data.alertsToday.toLocaleString('vi-VN')
        : data.server.healthy ? 'Ổn định' : 'Gián đoạn';
  const detail = metric.key === 'users'
    ? `${data.users.active.toLocaleString('vi-VN')} tài khoản đang hoạt động`
    : metric.key === 'devices'
    ? `${data.devices.online} online · ${data.devices.offline} offline · ${data.devices.unregistered} chưa đăng ký`
      : metric.key === 'alerts'
        ? 'Tổng cảnh báo phát sinh từ 00:00 hôm nay'
        : data.server.avgLatencyMs == null ? 'Chưa có dữ liệu độ trễ' : `Độ trễ trung bình ${data.server.avgLatencyMs} ms`;

  return (
    <article className="admin-metric card">
      <div className="admin-metric-top">
        <span className={`admin-metric-icon ${metric.color}`}><Icon name={metric.icon} size={20} /></span>
        {metric.key === 'devices' && <Badge tone="green" dot>{data.devices.online} online</Badge>}
        {metric.key === 'server' && <Badge tone={data.server.healthy ? 'green' : 'red'} dot>{data.server.healthy ? 'Healthy' : 'Offline'}</Badge>}
      </div>
      <div className="admin-metric-label">{metric.label}</div>
      <div className="admin-metric-value">{value}</div>
      <div className="admin-metric-detail">{detail}</div>
    </article>
  );
}

function TrafficChart({ traffic }) {
  return (
    <section className="card admin-traffic-card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Lưu lượng MQTT / HTTP</h2>
          <p className="card-sub">Số lượt gửi/nhận theo giờ · 12 giờ gần nhất</p>
        </div>
        <div className="admin-chart-legend">
          <span><i className="mqtt-in" />MQTT nhận</span>
          <span><i className="mqtt-out" />MQTT gửi</span>
          <span><i className="http" />HTTP mô phỏng</span>
        </div>
      </div>
      <div className="admin-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={traffic} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="adminMqttIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="adminMqttOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#647896', fontSize: 12 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#647896', fontSize: 12 }} />
            <Tooltip contentStyle={{ border: '1px solid #dfe7f2', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,.08)' }} />
            <Area type="monotone" dataKey="mqttIn" name="MQTT nhận" stroke="#4f46e5" fill="url(#adminMqttIn)" strokeWidth={2} />
            <Area type="monotone" dataKey="mqttOut" name="MQTT gửi" stroke="#22c55e" fill="url(#adminMqttOut)" strokeWidth={2} />
            <Area type="monotone" dataKey="httpRequests" name="HTTP mô phỏng" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="5 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SensorSummary({ sensors }) {
  return (
    <section className="card admin-sensors-card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Chỉ số cảm biến toàn hệ thống</h2>
          <p className="card-sub">Giá trị trung bình mới nhất từ thiết bị đang online</p>
        </div>
      </div>
      {sensors.length ? (
        <div className="admin-sensor-list">
          {sensors.map((sensor) => (
            <div className="admin-sensor-item" key={sensor.metric}>
              <span className="admin-sensor-label">{sensor.label}</span>
              <strong>{sensor.average} <small>{sensor.unit}</small></strong>
              <span className="admin-sensor-count">{sensor.count} cảm biến</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty>Chưa có số liệu từ cảm biến đang online.</Empty>
      )}
    </section>
  );
}

function OperationsSummary({ server, latencyHistory, incidentHistory }) {
  const metrics = [
    { label: 'Uptime thiết bị', value: server.deviceAvailabilityPercent == null ? '—' : `${server.deviceAvailabilityPercent}%` },
    { label: 'Độ trễ trung bình', value: server.avgLatencyMs == null ? '—' : `${server.avgLatencyMs} ms` },
    { label: 'Lệnh thất bại · 24h', value: server.commandFailurePercent == null ? '—' : `${server.commandFailurePercent}%` },
    { label: 'Sự cố · 7 ngày', value: incidentHistory.reduce((sum, day) => sum + day.total, 0).toLocaleString('vi-VN') },
  ];
  return (
    <div className="admin-operations-grid">
      <section className="card admin-ops-metrics">
        <div className="card-head">
          <div><h2 className="card-title">Theo dõi vận hành</h2><p className="card-sub">Tổng hợp telemetry gần nhất</p></div>
        </div>
        <div className="admin-ops-kpis">
          {metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}
        </div>
        <p className="admin-settings-note">Chỉ số được tính từ dữ liệu mock trong trình duyệt; khi dùng backend cần thay bằng telemetry thực.</p>
      </section>
      <section className="card admin-ops-chart">
        <div className="card-head"><div><h2 className="card-title">Độ trễ lệnh</h2><p className="card-sub">Độ trễ phản hồi theo giờ · 12 giờ gần nhất</p></div></div>
        <div className="admin-small-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencyHistory} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#647896', fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#647896', fontSize: 11 }} />
              <Tooltip contentStyle={{ border: '1px solid #dfe7f2', borderRadius: 10 }} />
              <Line type="monotone" dataKey="latencyMs" name="Độ trễ (ms)" stroke="#4f46e5" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="card admin-ops-chart">
        <div className="card-head"><div><h2 className="card-title">Lịch sử sự cố</h2><p className="card-sub">Số cảnh báo phát sinh theo ngày · 7 ngày</p></div></div>
        <div className="admin-small-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incidentHistory} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#647896', fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#647896', fontSize: 11 }} />
              <Tooltip contentStyle={{ border: '1px solid #dfe7f2', borderRadius: 10 }} />
              <Bar dataKey="total" name="Tổng sự cố" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="active" name="Đang mở" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function IncidentTable({ incidents }) {
  if (!incidents.length) return <Empty title="Không phát hiện thiết bị bất thường">Hệ thống hiện không có thiết bị offline hoặc cảnh báo đang mở.</Empty>;
  return (
    <div className="table-wrap">
      <table className="table admin-incident-table">
        <thead>
          <tr><th>Thiết bị / Sự cố</th><th>Người sở hữu</th><th>Vị trí</th><th>Trạng thái</th><th>Cập nhật</th></tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={`${incident.id}:${incident.status}`}>
              <td>
                <strong>{incident.deviceName}</strong>
                <span className="admin-incident-message">{incident.message}</span>
              </td>
              <td>{incident.ownerName}</td>
              <td>{incident.placeName}</td>
              <td>
                <Badge tone={incident.status === 'offline' || incident.status === 'critical' ? 'red' : 'amber'} dot>
                  {incident.status === 'offline' ? 'Offline' : incident.status === 'critical' ? 'Nguy hiểm' : 'Cảnh báo'}
                </Badge>
              </td>
              <td className="muted nowrap">{incident.updatedAt ? fmtTime(incident.updatedAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeveloperWorkspace({ data, filter, setFilter }) {
  const cards = {
    overview: [
      { label: 'Thiết bị online', value: data.devices.online, detail: 'Đang gửi telemetry và phản hồi lệnh' },
      { label: 'Thiết bị offline', value: data.devices.offline, detail: 'Cần kiểm tra kết nối / source điện' },
      { label: 'Thiết bị chưa đăng ký', value: data.devices.unregistered, detail: 'Đang chờ mã đăng ký / cấp quyền' },
      { label: 'Mức độ khỏe hệ thống', value: data.server.healthy ? 'Ổn định' : 'Cần xem xét', detail: data.server.avgLatencyMs == null ? 'Chưa có thông tin độ trễ' : `Độ trễ ~ ${data.server.avgLatencyMs} ms` },
    ],
    devices: [
      { label: 'Tổng thiết bị', value: data.devices.total, detail: 'Đã tích hợp trong mock data' },
      { label: 'Tỷ lệ online', value: `${Math.round((data.devices.online / Math.max(1, data.devices.total)) * 100)}%`, detail: 'Chỉ số hoạt động hiện tại' },
      { label: 'Tổng người dùng', value: data.users.total, detail: 'Số tài khoản đang quản lý' },
      { label: 'Tài khoản hoạt động', value: data.users.active, detail: 'Mức độ sử dụng hệ thống' },
    ],
    alerts: [
      { label: 'Cảnh báo hôm nay', value: data.alertsToday, detail: 'Số sự cố được ghi nhận trong ngày' },
      { label: 'Sự cố đang mở', value: data.incidents.filter((incident) => incident.status !== 'resolved').length, detail: 'Tình trạng cần theo dõi' },
      { label: 'Độ trễ lệnh', value: data.server.avgLatencyMs == null ? '—' : `${data.server.avgLatencyMs} ms`, detail: 'Đánh giá thời gian phản hồi' },
      { label: 'Trạng thái server', value: data.server.healthy ? 'Healthy' : 'Warning', detail: data.server.healthy ? 'Máy chủ đang ổn định' : 'Có dấu hiệu gián đoạn' },
    ],
    controls: [
      { label: 'Lệnh thất bại', value: data.server.commandFailurePercent == null ? '—' : `${data.server.commandFailurePercent}%`, detail: 'Tỉ lệ lệnh không thực thi thành công' },
      { label: 'Uptime thiết bị', value: data.server.deviceAvailabilityPercent == null ? '—' : `${data.server.deviceAvailabilityPercent}%`, detail: 'Thời gian thiết bị hoạt động' },
      { label: 'Sự cố 7 ngày', value: data.incidentHistory.reduce((sum, day) => sum + day.total, 0), detail: 'Tổng số sự cố trong 7 ngày' },
      { label: 'Lưu lượng MQTT', value: `${data.traffic.reduce((sum, item) => sum + (item.mqttIn || 0) + (item.mqttOut || 0), 0)}`, detail: 'Khối lượng tin nhắn hàng giờ' },
    ],
  };

  return (
    <section className="card admin-dev-panel">
      <div className="card-head">
        <div>
          <h2 className="card-title">Developer dashboard</h2>
          <p className="card-sub">Phân nhóm theo hệ thống, thiết bị, cảnh báo và điều khiển</p>
        </div>
      </div>
      <div className="admin-dev-filters">
        {DEV_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`admin-dev-filter${filter === item.key ? ' active' : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="admin-dev-grid">
        {cards[filter].map((card) => (
          <article key={card.label} className="admin-dev-metric">
            <div className="admin-dev-label">{card.label}</div>
            <div className="admin-dev-value">{card.value}</div>
            <div className="admin-dev-detail">{card.detail}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAdminDashboard();
  const isDeveloper = user?.role === 'developer';
  const [devFilter, setDevFilter] = useState('overview');
  return (
    <div className="page admin-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isDeveloper ? 'Tổng quan Developer' : 'Tổng quan Admin'}</h1>
          <p className="page-sub">
            {isDeveloper
              ? 'Theo dõi trạng thái thiết bị, lỗi điều khiển và số liệu vận hành để hỗ trợ triển khai SmartHome'
              : 'Giám sát hoạt động và sức khỏe toàn hệ thống SmartHome'}
          </p>
        </div>
        <button className="btn btn-outline" type="button" onClick={() => reload()} disabled={loading}>
          <Icon name="refresh" size={17} /> Làm mới
        </button>
      </div>

      {isDeveloper && data && (
        <DeveloperWorkspace data={data} filter={devFilter} setFilter={setDevFilter} />
      )}
      {error && <div className="alert-box alert-box-red" role="alert">{error.message}</div>}
      {loading && !data ? (
        <div className="grid grid-4">{METRICS.map((metric) => <Skeleton key={metric.key} height={164} />)}</div>
      ) : data ? (
        <>
          <div className="grid grid-4 admin-metrics">
            {METRICS.map((metric) => <MetricCard key={metric.key} metric={metric} data={data} />)}
          </div>
          <OperationsSummary server={data.server} latencyHistory={data.latencyHistory} incidentHistory={data.incidentHistory} />
          <SensorSummary sensors={data.sensors} />
          <div className="admin-dashboard-grid">
            <section className="card admin-incidents-card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Giám sát thiết bị</h2>
                  <p className="card-sub">Thiết bị mất kết nối và cảnh báo đang hoạt động</p>
                </div>
                <Badge tone={data.incidents.length ? 'amber' : 'green'} dot>{data.incidents.length} sự cố</Badge>
              </div>
              <IncidentTable incidents={data.incidents} />
            </section>
            <TrafficChart traffic={data.traffic} />
          </div>
        </>
      ) : (
        <div className="card"><Empty title="Chưa có dữ liệu tổng quan">Hãy kiểm tra kết nối API quản trị rồi thử tải lại.</Empty></div>
      )}
    </div>
  );
}
