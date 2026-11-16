import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { Badge, Empty, Skeleton } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtDateTime, fmtValue } from '../utils/format.js';
import { metricInfo } from '../utils/constants.js';
import './developer.css';

const POLL_MS = 10000;

function ComponentCard({ component }) {
  const model = component.componentModel ?? {};
  const data = component.data;
  const actuator = model.kind === 'actuator';
  const info = metricInfo(model.metric);
  const value = data?.value;
  return (
    <article className="developer-component-card">
      <div className="developer-component-head">
        <div>
          <strong>{model.label || model.name || 'Linh kiện'}</strong>
          <span>{model.name || 'Chưa có tên feed'}</span>
        </div>
        <Badge tone={actuator ? 'amber' : 'green'}>{actuator ? 'Chấp hành' : 'Cảm biến'}</Badge>
      </div>
      <div className="developer-component-value">
        {actuator
          ? component.pending ? 'Đang chờ phản hồi' : component.control?.mode === 'on' ? 'Đang bật' : 'Đang tắt'
          : value == null ? 'Chưa có dữ liệu' : `${fmtValue(model.metric, value)} ${model.unit ?? ''}`}
      </div>
      <div className="developer-component-meta">
        <span>{model.metric ? info.label : model.driver || 'Chưa có metric'}</span>
        <span>Cập nhật: {data?.ts ? fmtDateTime(data.ts) : 'Chưa có'}</span>
      </div>
      {model.driver && <div className="developer-component-driver">Driver: <code>{model.driver}</code></div>}
    </article>
  );
}

// Chi tiết một thiết bị (admin + developer): kết nối, dữ liệu mới nhất, linh kiện, lệnh gần đây
function DeviceDetail({ deviceId, base }) {
  const device = useApi(() => api.getDevice(deviceId), [deviceId], { poll: POLL_MS });
  const status = useApi(() => api.deviceStatus(deviceId), [deviceId], { poll: POLL_MS });
  const latest = useApi(() => api.deviceLatest(deviceId), [deviceId], { poll: POLL_MS });
  const commands = useApi(() => api.deviceCommands(deviceId, { limit: 12 }), [deviceId], { poll: POLL_MS });

  const refresh = () => Promise.all([
    device.reload(),
    status.reload(),
    latest.reload(),
    commands.reload(),
  ]);
  const busy = device.loading || status.loading || latest.loading || commands.loading;
  const error = device.error || status.error || latest.error || commands.error;

  if (device.loading && !device.data) {
    return <div className="page developer-page"><Skeleton height={190} /><Skeleton height={280} style={{ marginTop: 16 }} /></div>;
  }

  if (error && !device.data) {
    return (
      <div className="page developer-page">
        <Link className="developer-back-link" to={`${base}/devices`}>← Trở lại danh sách thiết bị</Link>
        <div className="alert-box alert-box-red" role="alert">{error.message}</div>
      </div>
    );
  }

  const components = latest.data?.components ?? [];
  const commandItems = commands.data?.items ?? [];
  const online = status.data?.online ?? device.data?.online;

  return (
    <div className="page developer-page">
      <Link className="developer-back-link" to={`${base}/devices`}>← Trở lại danh sách thiết bị</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">Chi tiết thiết bị</h1>
          <p className="page-sub">Kiểm tra kết nối, dữ liệu mới nhất, linh kiện và lịch sử lệnh.</p>
        </div>
        <button className="btn btn-outline" type="button" onClick={refresh} disabled={busy}>
          <Icon name="refresh" size={16} /> Làm mới
        </button>
      </div>

      {error && <div className="alert-box alert-box-red" role="alert">{error.message}</div>}

      <section className="card developer-device-overview">
        <div>
          <div className="developer-device-title-row">
            <h2>{device.data?.device_name ?? 'Thiết bị'}</h2>
            {online ? <Badge tone="green" dot>Online</Badge> : <Badge tone="red" dot>Offline</Badge>}
          </div>
          <div className="developer-device-id">Device ID: <code>{device.data?._id ?? deviceId}</code></div>
        </div>
        <dl className="developer-device-facts">
          <div><dt>Chủ sở hữu</dt><dd>{device.data?.owner_id ? device.data.owner_name ?? 'Đã đăng ký' : 'Chưa đăng ký'}</dd></div>
          <div><dt>Tin cuối</dt><dd>{status.data?.last_seen ? fmtDateTime(status.data.last_seen) : 'Chưa nhận dữ liệu'}</dd></div>
          <div><dt>Thời gian offline</dt><dd>{status.data?.seconds_since_last_seen == null ? '—' : `${status.data.seconds_since_last_seen} giây`}</dd></div>
          <div><dt>Ngưỡng offline</dt><dd>{status.data?.offline_after_seconds == null ? '—' : `${status.data.offline_after_seconds} giây`}</dd></div>
        </dl>
      </section>

      <section className="developer-section">
        <div className="developer-section-head">
          <div><h2>Telemetry & linh kiện</h2><p>Giá trị cảm biến và trạng thái chấp hành gần nhất.</p></div>
          <Badge tone="gray">{components.length} linh kiện</Badge>
        </div>
        {latest.loading && !latest.data ? <Skeleton height={180} /> : components.length ? (
          <div className="developer-component-grid">
            {components.map((component) => <ComponentCard key={component.componentModel?._id ?? component.component_id} component={component} />)}
          </div>
        ) : (
          <div className="card"><Empty title="Chưa có dữ liệu linh kiện">Kiểm tra mẫu thiết bị hoặc kết nối của bo mạch.</Empty></div>
        )}
      </section>

      <section className="card developer-command-section">
        <div className="card-head">
          <div><h2 className="card-title">Lệnh gần đây</h2><p className="card-sub">Nhật ký lệnh gần nhất của thiết bị, chỉ đọc.</p></div>
          <Badge tone="blue">{commandItems.length} lệnh</Badge>
        </div>
        {commands.loading && !commands.data ? <Skeleton height={180} /> : commandItems.length ? (
          <div className="table-wrap">
            <table className="table developer-command-table">
              <thead><tr><th>Thời gian</th><th>Linh kiện</th><th>Nguồn</th><th>Kết quả</th><th>Độ trễ</th><th>Thông tin</th></tr></thead>
              <tbody>
                {commandItems.map((command) => (
                  <tr key={command._id}>
                    <td className="nowrap">{command.sent_at ? fmtDateTime(command.sent_at) : '—'}</td>
                    <td>{components.find((item) => item.componentModel?._id === command.component_model_id)?.componentModel?.label ?? command.component_model_id?.slice(-8) ?? '—'}</td>
                    <td>{command.source ?? '—'}</td>
                    <td>
                      <Badge tone={command.status === 'success' ? 'green' : command.status === 'failed' ? 'red' : command.status === 'pending' ? 'blue' : 'gray'}>
                        {command.status ?? '—'}
                      </Badge>
                    </td>
                    <td>{command.latency_ms == null ? '—' : `${command.latency_ms} ms`}</td>
                    <td className="developer-command-reason">{command.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Chưa có lệnh">Lệnh điều khiển của thiết bị sẽ xuất hiện ở đây.</Empty>
        )}
      </section>
    </div>
  );
}

export default function DeveloperDiagnostics() {
  const { deviceId } = useParams();
  const { user } = useAuth();
  const base = user?.role === 'developer' ? '/developer' : '/admin';
  return deviceId ? <DeviceDetail deviceId={deviceId} base={base} /> : <Navigate to={`${base}/devices`} replace />;
}
