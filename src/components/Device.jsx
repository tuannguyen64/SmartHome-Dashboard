import { useEffect, useState } from 'react';
import { DEVICE_MODES, metricInfo, RGB_PALETTE } from '../utils/constants.js';
import { fmtValue, timeAgo } from '../utils/format.js';
import { actuatorView } from '../hooks/useControl.js';
import { FigmaIcon } from './icons.jsx';
import { Badge, ColorSwatches, Spinner, Toggle } from './ui.jsx';

// Icon theo metric của component_model
export function MetricIcon({ metric, size = 44 }) {
  if (metric === 'fan_speed') return <FigmaIcon name="fanTile" size={size} />;
  const m = metricInfo(metric);
  if (m.emoji)
    return (
      <span className="icon-tile" style={{ background: m.tint, width: size, height: size, fontSize: Math.round(size * 0.5) }}>
        {m.emoji}
      </span>
    );
  return (
    <span className="icon-tile" style={{ background: m.tint, width: size, height: size }}>
      <FigmaIcon name={m.icon} size={Math.round(size * 0.55)} />
    </span>
  );
}

// Icon đại diện cho thiết bị: theo bộ phận chấp hành đầu tiên
export function DeviceIcon({ comps, size = 44 }) {
  const a = comps.find((c) => c.componentModel.kind === 'actuator') ?? comps[0];
  return <MetricIcon metric={a?.componentModel.metric} size={size} />;
}

// Ô thiết bị trên trang Tổng quan: tên, vị trí, online, chế độ, các bộ phận
export function DeviceCard({ device, comps, path, queued, onSend, onMode }) {
  const offline = !device.online;
  const forced = device.mode !== 'custom';
  const sensors = comps.filter((c) => c.componentModel.kind === 'sensor');
  const actuators = comps.filter((c) => c.componentModel.kind === 'actuator');
  return (
    <div className={`dev${offline ? ' dev-offline' : ''}`}>
      <div className="dev-row">
        <DeviceIcon comps={comps} />
        <div className="dev-info">
          <div className="dev-name">{device.device_name}</div>
          <div className="dev-sub">
            {path?.split(' › ').pop() || 'Chưa có vị trí'} · {offline ? `offline, tin cuối ${timeAgo(device.last_seen)}` : 'online'}
          </div>
        </div>
        {offline ? (
          <Badge tone="gray">offline</Badge>
        ) : (
          <select
            className="select dev-mode"
            value={device.mode}
            onChange={(e) => onMode(device, e.target.value)}
            title={DEVICE_MODES[device.mode].hint}
            aria-label="Chế độ thiết bị"
          >
            {Object.entries(DEVICE_MODES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {sensors.length > 0 && (
        <div className="dev-sensors">
          {sensors.map((s) => (
            <span key={s._id}>
              {s.componentModel.label}: <strong>{fmtValue(s.componentModel.metric, s.data?.value)}</strong> {s.componentModel.unit}
            </span>
          ))}
        </div>
      )}
      {forced && <div className="small" style={{ color: 'var(--amber)' }}>{DEVICE_MODES[device.mode].hint}</div>}
      {actuators.map((c) => (
        <ActuatorControl key={c._id} comp={c} queued={queued[c._id]} disabled={offline || forced} onSend={onSend} />
      ))}
    </div>
  );
}

export function ActuatorControl({ comp, queued, disabled, onSend }) {
  const cm = comp.componentModel;
  const v = actuatorView(comp, queued);
  const isRgb = cm.metric === 'rgb_color';
  const isSwitch = cm.type === 'switch';
  const minStart = cm.min_start;
  const [local, setLocal] = useState(v.level ?? 0);
  const [dragging, setDragging] = useState(false);
  const [lowWarn, setLowWarn] = useState(null);
  useEffect(() => {
    if (!dragging && lowWarn == null) setLocal(v.level ?? 0);
  }, [v.level, dragging, lowWarn]);

  const turn = (on) => {
    if (!on) return onSend(comp, { mode: 'off' });
    if (isRgb) return onSend(comp, { mode: 'on', val: { color: v.color, pixels: [0, 1, 2, 3] } });
    if (isSwitch) return onSend(comp, { mode: 'on' }); // công tắc: backend bật mức tối đa
    // thanh trượt: bật ở mức đang chọn (tối thiểu min_start)
    const lv = Math.max(Number(local) || Math.round(((cm.range?.min ?? 0) + (cm.range?.max ?? 100)) / 2), minStart ?? 0);
    onSend(comp, { mode: 'on', val: lv });
  };

  const commit = () => {
    setDragging(false);
    const lv = Number(local);
    if (lv === v.level) return;
    if (lv === 0) return onSend(comp, { mode: 'off' });
    // Backend từ chối mức dưới min_start (vd quạt < 30%) → chặn ngay trên giao diện
    if (minStart != null && lv < minStart) return setLowWarn(lv);
    onSend(comp, { mode: 'on', val: lv });
  };

  return (
    <div className="dev-ctrl">
      <div className="dev-ctrl-head">
        <span className="inline" style={{ gap: 8 }}>
          {cm.label}
          {v.pending && (
            <span className="dev-wait">
              <Spinner /> Đang chờ phản hồi
            </span>
          )}
        </span>
        <span className="inline" style={{ gap: 10 }}>
          {!isRgb && !isSwitch && <strong className="mono">{local}{cm.unit}</strong>}
          {isSwitch && (
            <span className="small" style={{ color: v.on ? (cm.name === 'led' ? '#dc2626' : 'var(--green)') : 'var(--muted)' }}>
              {v.on ? (cm.name === 'led' ? 'Sáng đỏ' : 'Đang bật') : 'Tắt'}
            </span>
          )}
          {isRgb && <span className="dev-color" style={{ background: v.color }} />}
          <Toggle on={v.on} pending={v.pending} disabled={disabled} onChange={turn} label={`Bật/tắt ${cm.label}`} />
        </span>
      </div>
      {!isRgb && !isSwitch && cm.range && (
        <input
          type="range"
          className="slider"
          min={cm.range.min}
          max={cm.range.max}
          value={local}
          disabled={disabled}
          style={{ '--fill': `${((local - cm.range.min) / (cm.range.max - cm.range.min)) * 100}%` }}
          aria-label={cm.label}
          onChange={(e) => {
            setDragging(true);
            setLowWarn(null);
            setLocal(Number(e.target.value));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
        />
      )}
      {lowWarn != null && (
        <div className="alert-box alert-box-amber" style={{ flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 200px' }}>{cm.label} chỉ chạy từ mức {minStart}{cm.unit}. Kéo về 0 để tắt.</span>
          <button className="btn btn-sm btn-primary" onClick={() => { setLowWarn(null); setLocal(minStart); onSend(comp, { mode: 'on', val: minStart }); }}>
            Dùng {minStart}{cm.unit}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => { setLowWarn(null); setLocal(v.level ?? 0); }}>
            Hủy
          </button>
        </div>
      )}
      {isRgb && (
        <>
          <ColorSwatches
            value={v.color}
            colors={RGB_PALETTE}
            disabled={disabled}
            onChange={(color) => onSend(comp, { mode: v.on ? 'on' : 'off', val: { color, pixels: [0, 1, 2, 3] } })}
          />
          {!v.on && <span className="small muted">Đèn đang tắt: màu mới được lưu và dùng ở lần bật sau.</span>}
        </>
      )}
    </div>
  );
}
