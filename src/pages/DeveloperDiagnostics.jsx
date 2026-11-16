import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { Badge, Empty, Field, Modal, Skeleton, useConfirm } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { useToast } from '../context/ToastContext.jsx';
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

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const daysText = (days) => (!days?.length || days.length === 7 ? 'Mỗi ngày' : [...days].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)).map((d) => DAY_NAMES[d]).join(', '));
const stepText = (step) => (!step ? null : step.mode === 'on' ? `bật${step.val != null ? ` ${step.val}` : ''}` : 'tắt');
const rangeText = (r) => {
  const u = r.unit ? ` ${r.unit}` : '';
  if (r.min != null && r.max != null) return `ngoài ${r.min} – ${r.max}${u}`;
  if (r.min != null) return `dưới ${r.min}${u}`;
  if (r.max != null) return `trên ${r.max}${u}`;
  return 'chưa đặt ngưỡng';
};

function OwnerCard({ info }) {
  const owner = info.data?.owner;
  return (
    <section className="card developer-owner-card">
      <div className="card-head"><h2 className="card-title">Chủ sở hữu</h2>{owner && !owner.is_active && <Badge tone="red">Tài khoản bị khóa</Badge>}</div>
      {info.error ? <div className="alert-box alert-box-red">{info.error.message}</div> : info.loading && !info.data ? <Skeleton height={150} /> : !owner ? (
        <Empty title="Chưa có chủ sở hữu">Thiết bị chưa được đăng ký cho tài khoản nào.</Empty>
      ) : (
        <dl className="developer-owner-facts">
          <div><dt>Họ tên</dt><dd><strong>{owner.full_name}</strong> <span className="muted">@{owner.username}</span></dd></div>
          <div><dt>Email</dt><dd>{owner.email ? <a href={`mailto:${owner.email}`}>{owner.email}</a> : <span className="muted">Chưa khai báo</span>}</dd></div>
          <div><dt>Số điện thoại</dt><dd>{owner.phone ? <a href={`tel:${owner.phone.replace(/[^+0-9]/g, '')}`}>{owner.phone}</a> : <span className="muted">Chưa khai báo</span>}</dd></div>
          <div><dt>Địa chỉ nhà</dt><dd>{owner.address || <span className="muted">Chưa khai báo</span>}</dd></div>
        </dl>
      )}
    </section>
  );
}

function AutomationCard({ info }) {
  const rules = info.data?.rules ?? [];
  const schedules = info.data?.schedules ?? [];
  return (
    <section className="card developer-automation-card">
      <div className="card-head">
        <h2 className="card-title">Quy tắc tự động</h2>
        <Badge tone="gray">{rules.length} quy tắc · {schedules.length} lịch hẹn</Badge>
      </div>
      {info.loading && !info.data ? <Skeleton height={150} /> : !rules.length && !schedules.length ? (
        <Empty title="Chưa có quy tắc">Chủ sở hữu chưa đặt ngưỡng tự động hay lịch hẹn giờ cho thiết bị này.</Empty>
      ) : (
        <ul className="developer-rule-list">
          {rules.map((r) => (
            <li key={r._id}>
              <div className="developer-rule-top">
                <strong>{r.name}</strong>
                <span className="inline" style={{ gap: 6 }}>
                  <Badge tone={r.severity === 'danger' ? 'red' : 'amber'}>Ngưỡng</Badge>
                  {!r.enabled && <Badge tone="gray">Đang tắt</Badge>}
                </span>
              </div>
              <p>
                Khi {r.sensor}{r.sensor_device ? ` (${r.sensor_device})` : ''} {rangeText(r)}
                {r.auto_action?.enabled ? ` → ${stepText(r.auto_action.on_breach)} ${r.auto_action.component}${r.auto_action.device ? ` (${r.auto_action.device})` : ''}${r.auto_action.on_resolve ? `, trở lại bình thường thì ${stepText(r.auto_action.on_resolve)}` : ''}` : ' → chỉ cảnh báo'}
              </p>
            </li>
          ))}
          {schedules.map((x) => (
            <li key={x._id}>
              <div className="developer-rule-top">
                <strong>{x.name}</strong>
                <span className="inline" style={{ gap: 6 }}>
                  <Badge tone="blue">Hẹn giờ</Badge>
                  {!x.enabled && <Badge tone="gray">Đang tắt</Badge>}
                </span>
              </div>
              <p>{x.time} · {daysText(x.days)} → {stepText(x.action)} {x.component}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Chi tiết một thiết bị (admin + developer): kết nối, dữ liệu mới nhất, linh kiện, lệnh gần đây
function DeviceDetail({ deviceId, base }) {
  const navigate = useNavigate();
  const toast = useToast();
  const act = useAction();
  const [confirm, dialog] = useConfirm();
  const [renaming, setRenaming] = useState(null);
  const device = useApi(() => api.getDevice(deviceId), [deviceId], { poll: POLL_MS });
  const status = useApi(() => api.deviceStatus(deviceId), [deviceId], { poll: POLL_MS });
  const latest = useApi(() => api.deviceLatest(deviceId), [deviceId], { poll: POLL_MS });
  const info = useApi(() => api.deviceOwnerInfo(deviceId), [deviceId]);

  const refresh = () => Promise.all([
    device.reload(),
    status.reload(),
    latest.reload(),
    info.reload(),
  ]);
  const busy = device.loading || status.loading || latest.loading || info.loading;
  const error = device.error || status.error || latest.error;

  const rename = async (event) => {
    event.preventDefault();
    try {
      await act(() => api.updateDevice(deviceId, { device_name: renaming.trim() }));
      toast.success('Đã đổi tên thiết bị.');
      setRenaming(null);
      device.reload({ silent: true });
    } catch (error) {
      toast.error(error.message || 'Không đổi được tên.');
    }
  };

  const remove = async () => {
    const name = device.data?.device_name ?? 'thiết bị';
    if (!(await confirm({
      title: 'Xóa thiết bị?',
      message: `Xóa hẳn "${name}" khỏi hệ thống, kèm quy tắc và lịch hẹn liên quan. Chủ sở hữu sẽ không còn thấy thiết bị này. Không hoàn tác được.`,
      confirmText: 'Xóa thiết bị',
      danger: true,
    }))) return;
    try {
      await act(() => api.deleteDevice(deviceId));
      toast.success(`Đã xóa "${name}".`);
      navigate(`${base}/devices`, { replace: true });
    } catch (error) {
      toast.error(error.message || 'Không xóa được thiết bị.');
    }
  };

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
  const online = status.data?.online ?? device.data?.online;

  return (
    <div className="page developer-page">
      <Link className="developer-back-link" to={`${base}/devices`}>← Trở lại danh sách thiết bị</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">Chi tiết thiết bị</h1>
          <p className="page-sub">Kết nối, dữ liệu mới nhất, chủ sở hữu và các quy tắc tự động của thiết bị.</p>
        </div>
        <div className="inline">
          <button className="btn btn-outline" type="button" onClick={refresh} disabled={busy}>
            <Icon name="refresh" size={16} /> Làm mới
          </button>
          <button className="btn btn-outline" type="button" disabled={!device.data} onClick={() => setRenaming(device.data.device_name)}>
            <Icon name="pencil" size={16} /> Đổi tên
          </button>
          <button className="btn btn-danger" type="button" disabled={!device.data} onClick={remove}>
            <Icon name="trash" size={16} /> Xóa thiết bị
          </button>
        </div>
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
          <div><dt>Vị trí</dt><dd>{info.data?.place_path ?? (device.data?.owner_id ? 'Chưa xếp vị trí' : 'Chưa đăng ký')}</dd></div>
          <div><dt>Tin cuối</dt><dd>{status.data?.last_seen ? fmtDateTime(status.data.last_seen) : 'Chưa nhận dữ liệu'}</dd></div>
          <div><dt>Thời gian offline</dt><dd>{status.data?.seconds_since_last_seen == null ? '—' : `${status.data.seconds_since_last_seen} giây`}</dd></div>
          <div><dt>Ngưỡng offline</dt><dd>{status.data?.offline_after_seconds == null ? '—' : `${status.data.offline_after_seconds} giây`}</dd></div>
        </dl>
      </section>

      <div className="developer-detail-grid">
        <OwnerCard info={info} />
        <AutomationCard info={info} />
      </div>

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

      {renaming !== null && (
        <Modal
          title="Đổi tên thiết bị"
          onClose={() => setRenaming(null)}
          width={440}
          footer={(
            <>
              <button className="btn btn-soft" type="button" onClick={() => setRenaming(null)}>Hủy</button>
              <button className="btn btn-primary" type="submit" form="rename-device-form">Lưu</button>
            </>
          )}
        >
          <form id="rename-device-form" onSubmit={rename}>
            <Field label="Tên thiết bị">
              <input className="input" required autoFocus value={renaming} onChange={(event) => setRenaming(event.target.value)} />
            </Field>
          </form>
        </Modal>
      )}
      {dialog}
    </div>
  );
}

export default function DeveloperDiagnostics() {
  const { deviceId } = useParams();
  const { user } = useAuth();
  const base = user?.role === 'developer' ? '/developer' : '/admin';
  return deviceId ? <DeviceDetail deviceId={deviceId} base={base} /> : <Navigate to={`${base}/devices`} replace />;
}
