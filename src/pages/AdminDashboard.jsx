import { Link } from 'react-router-dom';
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

function SensorSummary({ sensors, title = 'Chỉ số cảm biến toàn hệ thống' }) {
  return (
    <section className="card admin-sensors-card">
      <div className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
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
  if (!incidents.length) return <Empty title="Không phát hiện thiết bị bất thường">Không có thiết bị offline hoặc cảnh báo đang mở.</Empty>;
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

function IncidentHistoryChart({ history }) {
  return (
    <section className="card admin-ops-chart">
      <div className="card-head"><div><h2 className="card-title">Lịch sử sự cố</h2><p className="card-sub">Số cảnh báo phát sinh theo ngày · 7 ngày</p></div></div>
      <div className="admin-small-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={history} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
  );
}

// Kỹ thuật viên: mọi số liệu chỉ tính trên thiết bị do mình lắp, không có thông tin máy chủ / toàn hệ thống
function TechnicianOverview({ data }) {
  const { devices } = data;
  const uptime = devices.total ? Math.round((devices.online / devices.total) * 100) : null;
  const cards = [
    { key: 'customers', label: 'Khách hàng', icon: 'user', color: 'blue', value: data.users.total, detail: 'Có thiết bị do bạn lắp đặt' },
    { key: 'devices', label: 'Thiết bị đã lắp', icon: 'home', color: 'green', value: devices.total, detail: `${devices.online} online · ${devices.offline} offline`, badge: <Badge tone="green" dot>{devices.online} online</Badge> },
    { key: 'alerts', label: 'Cảnh báo hôm nay', icon: 'alert', color: 'amber', value: data.alertsToday, detail: 'Trên các thiết bị bạn đã lắp' },
    { key: 'commands', label: 'Lệnh 24 giờ', icon: 'send', color: 'purple', value: data.commands24h ?? 0, detail: uptime == null ? 'Chưa có thiết bị nào' : `Tỷ lệ thiết bị online ${uptime}%` },
  ];
  if (!devices.total) {
    return (
      <div className="card">
        <Empty title="Bạn chưa lắp thiết bị nào" action={<Link className="btn btn-primary" to="/developer/lap-dat">Lắp đặt cho khách</Link>}>
          Số liệu ở đây chỉ tính trên các thiết bị bạn đã lắp tại nhà khách.
        </Empty>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-4 admin-metrics">
        {cards.map((card) => (
          <article key={card.key} className="admin-metric card">
            <div className="admin-metric-top">
              <span className={`admin-metric-icon ${card.color}`}><Icon name={card.icon} size={20} /></span>
              {card.badge}
            </div>
            <div className="admin-metric-label">{card.label}</div>
            <div className="admin-metric-value">{Number(card.value).toLocaleString('vi-VN')}</div>
            <div className="admin-metric-detail">{card.detail}</div>
          </article>
        ))}
      </div>
      <SensorSummary sensors={data.sensors} title="Chỉ số cảm biến tại nhà khách" />
      <div className="admin-dashboard-grid">
        <section className="card admin-incidents-card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Thiết bị cần kiểm tra</h2>
              <p className="card-sub">Thiết bị bạn lắp đang mất kết nối hoặc có cảnh báo</p>
            </div>
            <Badge tone={data.incidents.length ? 'amber' : 'green'} dot>{data.incidents.length} sự cố</Badge>
          </div>
          <IncidentTable incidents={data.incidents} />
        </section>
        <IncidentHistoryChart history={data.incidentHistory} />
      </div>
    </>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAdminDashboard();
  const isDeveloper = user?.role === 'developer';
  return (
    <div className="page admin-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isDeveloper ? 'Tổng quan Kỹ thuật viên' : 'Tổng quan Admin'}</h1>
          <p className="page-sub">
            {isDeveloper
              ? 'Số liệu chỉ tính trên các thiết bị bạn đã lắp đặt tại nhà khách'
              : 'Giám sát hoạt động và sức khỏe toàn hệ thống SmartHome'}
          </p>
        </div>
        <button className="btn btn-outline" type="button" onClick={() => reload()} disabled={loading}>
          <Icon name="refresh" size={17} /> Làm mới
        </button>
      </div>

      {error && <div className="alert-box alert-box-red" role="alert">{error.message}</div>}
      {loading && !data ? (
        <div className="grid grid-4">{METRICS.map((metric) => <Skeleton key={metric.key} height={164} />)}</div>
      ) : data && isDeveloper ? (
        <TechnicianOverview data={data} />
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
