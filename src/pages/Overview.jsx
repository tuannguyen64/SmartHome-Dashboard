import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, USE_MOCK } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi, useNow } from '../hooks/useApi.js';
import { useHome } from '../hooks/useHome.js';
import { useControl } from '../hooks/useControl.js';
import { DeviceCard, MetricIcon } from '../components/Device.jsx';
import { FigmaIcon, Icon } from '../components/icons.jsx';
import { Badge, Empty, Skeleton } from '../components/ui.jsx';
import { ALERT_STATUS, ALERT_TYPES, DEVICE_MODES, PARAMS } from '../utils/constants.js';
import { fmtDate, fmtTime, fmtValue, fmtWeekday, greeting, timeAgo } from '../utils/format.js';
import { alertTone, sensorStatus, thresholdText } from '../utils/status.js';
import './overview.css';

// UC02-1 Tổng quan + UC03 điều khiển + chế độ thiết bị (devices.mode)
export default function Overview() {
  const { user } = useAuth();
  const toast = useToast();
  const act = useAction();
  const now = useNow(10000);
  const { home, loading, error, reload } = useHome();
  const rules = useApi(() => api.listRules().catch(() => []), []);
  const summary = useApi(() => api.alertSummary().catch(() => null), [], { poll: USE_MOCK ? 0 : PARAMS.POLL_MS });
  const afterSend = useCallback(() => !USE_MOCK && [1500, 4000].forEach((ms) => setTimeout(() => reload({ silent: true }), ms)), [reload]);
  const { send, queued } = useControl(afterSend);
  useLiveEvent('alert', () => summary.reload({ silent: true }));

  const setMode = async (device, mode) => {
    try {
      await act(() => api.updateDevice(device._id, { mode }));
      toast.success(DEVICE_MODES[mode].hint, `${device.device_name}: ${DEVICE_MODES[mode].label}`);
      reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const devices = home?.devices ?? [];
  const onCount = home ? home.actuators.filter((c) => (c.mode ?? c.control?.mode) === 'on').length : 0;
  const lastUpdate = home?.sensors.reduce((m, s) => (s.data?.ts && s.data.ts > m ? s.data.ts : m), '');

  // Nhóm thiết bị theo vị trí (phòng / khu vực)
  const groups = [];
  if (home) {
    const byPlace = new Map();
    devices.forEach((d) => {
      const key = home.paths.has(d.place_id) ? d.place_id : 'shared';
      byPlace.set(key, [...(byPlace.get(key) ?? []), d]);
    });
    [...byPlace.entries()]
      .sort(([a], [b]) => (home.paths.get(a) ?? '~').localeCompare(home.paths.get(b) ?? '~'))
      .forEach(([key, list]) => groups.push({ key, title: key === 'shared' ? 'Được chia sẻ với bạn' : home.paths.get(key), list }));
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title inline" style={{ gap: 12 }}>
            {greeting()}, {(user?.full_name || user?.username || '').split(' ').pop()}
            <FigmaIcon name="wave" size={30} />
          </h1>
          <p className="page-sub">
            {fmtWeekday(now)}, {fmtDate(now)}
            {lastUpdate && ` · Cập nhật lúc ${fmtTime(lastUpdate)}`}
            {home && ` · ${devices.filter((d) => d.online).length}/${devices.length} thiết bị online`}
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => { reload(); summary.reload({ silent: true }); rules.reload({ silent: true }); }}>
          <Icon name="refresh" size={17} /> Làm mới
        </button>
      </div>

      {error && <div className="alert-box alert-box-red">{error.message}</div>}

      {loading && !home ? (
        <div className="grid grid-4">
          {[0, 1, 2, 3].map((i) => (
            <div className="card" key={i}>
              <Skeleton height={44} width={44} />
              <Skeleton height={40} width="50%" style={{ marginTop: 18 }} />
              <Skeleton height={16} width="70%" style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      ) : !devices.length ? (
        <div className="card">
          <Empty title="Bạn chưa có thiết bị nào" action={<Link className="btn btn-primary" to="/thiet-bi">Tạo vị trí và đăng ký thiết bị</Link>}>
            Tạo nhà, phòng rồi nhập mã đăng ký in trên bo để bắt đầu theo dõi.
          </Empty>
        </div>
      ) : (
        <>
          <div className="grid grid-4">
            {home.sensors.map((s) => (
              <SensorCard key={s._id} comp={s} rules={rules.data} path={home.paths.get(s.place_id)} now={now} />
            ))}
            <AlertCountCard summary={summary.data} />
          </div>

          <div className="ov-bottom">
            <section className="card">
              <div className="card-head">
                <h2 className="card-title">Thiết bị</h2>
                <div className="inline">
                  <span className="muted">{onCount}/{home.actuators.length} đang bật</span>
                  <Link to="/thiet-bi">Quản lý</Link>
                </div>
              </div>
              <div className="stack" style={{ gap: 22 }}>
                {groups.map((g) => (
                  <div key={g.key} className="ov-room">
                    <div className="ov-room-head">
                      <strong>{g.title}</strong>
                    </div>
                    <div className="ov-devices">
                      {g.list.map((d) => (
                        <DeviceCard
                          key={d._id}
                          device={d}
                          comps={home.compsOf(d._id)}
                          path={home.paths.get(d.place_id)}
                          queued={queued}
                          onSend={send}
                          onMode={setMode}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h2 className="card-title">Cảnh báo gần đây</h2>
                <Link to="/canh-bao">Xem tất cả</Link>
              </div>
              {!summary.data ? (
                summary.loading ? <Skeleton height={200} /> : <Empty>Chưa lấy được cảnh báo.</Empty>
              ) : summary.data.recent.length === 0 ? (
                <Empty>Chưa có cảnh báo nào.</Empty>
              ) : (
                <div className="ov-alerts">
                  {summary.data.recent.map((a) => (
                    <Link key={a._id} to={`/canh-bao?id=${a._id}`} className="ov-alert">
                      <span className={`dot dot-${alertTone(a)}`} style={{ marginTop: 7 }} />
                      <div style={{ minWidth: 0 }}>
                        <div className="ov-alert-title">
                          {ALERT_TYPES[a.type]}
                          {!a.seen && <span className="dot dot-blue" style={{ width: 7, height: 7, marginLeft: 8, verticalAlign: 'middle' }} />}
                        </div>
                        <div className="ov-alert-text">{a.message}</div>
                        <div className="ov-alert-time">
                          {fmtTime(a.triggered_at)} · {ALERT_STATUS[a.status].label}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function SensorCard({ comp, rules, path, now }) {
  const cm = comp.componentModel;
  const st = sensorStatus(comp, rules);
  const dim = st.key === 'offline';
  return (
    <div className={`card ov-sensor${dim ? ' dim' : ''}`}>
      <div className="ov-sensor-top">
        <MetricIcon metric={cm.metric} />
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="ov-value">
        {comp.data?.value == null ? (
          <span className="ov-nodata">Chưa có dữ liệu</span>
        ) : (
          <>
            <span className={`ov-num tone-${st.tone}`}>{fmtValue(cm.metric, comp.data.value)}</span>
            <span className="ov-unit">{cm.unit}</span>
          </>
        )}
      </div>
      <div className="ov-label">
        {cm.label} · {path?.split(' › ').pop() ?? comp.device_name}
      </div>
      <div className="ov-meta">
        {thresholdText(comp, rules)}
        {comp.data?.ts && ` · ${dim ? `đo lần cuối ${fmtTime(comp.data.ts)}` : timeAgo(comp.data.ts, now)}`}
      </div>
    </div>
  );
}

function AlertCountCard({ summary }) {
  const active = summary?.active ?? 0;
  return (
    <Link to="/canh-bao?status=active" className="card ov-sensor ov-alertcard">
      <div className="ov-sensor-top">
        <span className="icon-tile" style={{ background: active ? '#fff2f3' : '#f0fdf4' }}>
          <FigmaIcon name="warning" size={20} style={{ filter: active ? 'none' : 'grayscale(1) opacity(.5)' }} />
        </span>
        <Badge tone={active ? 'red' : 'green'}>{active ? 'Cần chú ý' : 'Ổn định'}</Badge>
      </div>
      <div className="ov-value">
        <span className="ov-num">{summary ? active : '—'}</span>
      </div>
      <div className="ov-label">Cảnh báo đang mở</div>
      <div className="ov-meta">{summary?.unseen ? `${summary.unseen} cảnh báo chưa xem` : 'Không có cảnh báo chưa xem'}</div>
    </Link>
  );
}
