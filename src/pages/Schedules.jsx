import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { useHome } from '../hooks/useHome.js';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { MetricIcon } from '../components/Device.jsx';
import { Icon } from '../components/icons.jsx';
import { Badge, ColorSwatches, Empty, Field, Segmented, Skeleton, Toggle, useConfirm } from '../components/ui.jsx';
import { DEVICE_MODES, RGB_PALETTE, WEEKDAYS } from '../utils/constants.js';
import { buildCron, describeCron, fmtTime, parseCron, vnParts } from '../utils/format.js';

function fmtNextRun(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const p = vnParts(t);
  const same = (a, b) => a.year === b.year && a.month === b.month && a.day === b.day;
  if (same(p, vnParts(Date.now()))) return `Hôm nay ${fmtTime(t)}`;
  if (same(p, vnParts(Date.now() + 86400e3))) return `Ngày mai ${fmtTime(t)}`;
  const wd = WEEKDAYS.find((w) => w.key === p.weekday).short;
  return `${wd}, ${String(p.day).padStart(2, '0')}/${String(p.month + 1).padStart(2, '0')} ${fmtTime(t)}`;
}

const emptyForm = (component_id = '') => ({
  _id: null, name: '', component_id, mode: 'on', level: 50, color: '#ffcc00',
  hh: '06', mm: '30', repeat: 'weekly', days: [1, 2, 3, 4, 5], enabled: true,
});

// UC04-3 Quản lý lịch hẹn giờ (collection schedules: component_id, action, cron, timezone)
export default function Schedules() {
  const toast = useToast();
  const act = useAction();
  const [confirm, dialog] = useConfirm();
  const { home, loading: homeLoading } = useHome();
  const list = useApi(() => api.listSchedules(), []);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  useLiveEvent('schedule', () => list.reload({ silent: true }));

  const actuators = home?.actuators ?? [];
  const f = form ?? emptyForm(actuators[0]?._id ?? '');
  const set = (k, v) => setForm({ ...f, [k]: v });
  const comp = actuators.find((a) => a._id === f.component_id);
  const cm = comp?.componentModel;
  const items = (list.data ?? [])
    .filter((s) => (filter === 'all' ? true : filter === 'on' ? s.enabled : !s.enabled))
    .sort((a, b) => describeCron(a.cron).time.localeCompare(describeCron(b.cron).time));

  const edit = (s) => {
    setFields({});
    setError(null);
    const c = parseCron(s.cron);
    const v = s.action.value;
    setForm({
      _id: s._id, name: s.name, component_id: s.component_id, mode: s.action.mode,
      level: typeof v === 'number' ? v : 50, color: v?.color ?? '#ffcc00',
      hh: c.hh, mm: c.mm, repeat: c.days ? 'weekly' : 'daily', days: c.days ?? [1, 2, 3, 4, 5], enabled: s.enabled,
    });
  };
  const reset = () => {
    setForm(null);
    setFields({});
    setError(null);
  };

  const save = async () => {
    setFields({});
    setError(null);
    if (f.repeat === 'weekly' && !f.days.length) return setFields({ days: 'Chọn ít nhất một ngày' }); // A3
    const hh = Math.min(23, Math.max(0, Number(f.hh) || 0));
    const mm = Math.min(59, Math.max(0, Number(f.mm) || 0));
    const value = cm?.metric === 'rgb_color' ? { color: f.color, pixels: [0, 1, 2, 3] } : cm?.type === 'switch' ? cm.range?.max ?? 1 : Number(f.level);
    setSaving(true);
    try {
      const s = await act(() =>
        api.saveSchedule({
          _id: f._id,
          name: f.name || `${f.mode === 'on' ? 'Bật' : 'Tắt'} ${cm?.label ?? ''} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
          component_id: f.component_id,
          action: f.mode === 'on' ? { mode: 'on', value } : { mode: 'off' },
          cron: buildCron(hh, mm, f.repeat === 'daily' ? null : f.days),
          enabled: f.enabled,
        }),
      );
      toast.success(`Lần chạy kế tiếp: ${fmtNextRun(s.next_run_at)}`, f._id ? 'Đã lưu lịch hẹn' : 'Đã thêm lịch hẹn');
      reset();
      list.reload({ silent: true });
    } catch (e) {
      setFields(e.details?.fields ?? {});
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s, enabled) => {
    try {
      await act(() => api.setScheduleEnabled(s._id, enabled));
      list.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async (s) => {
    if (!(await confirm({ title: 'Xóa lịch hẹn?', message: `Xóa lịch "${s.name}". Lịch sử điều khiển của lịch vẫn được giữ.`, danger: true, confirmText: 'Xóa' }))) return;
    try {
      await act(() => api.deleteSchedule(s._id));
      if (f._id === s._id) reset();
      list.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleDay = (k) => set('days', f.days.includes(k) ? f.days.filter((d) => d !== k) : [...f.days, k]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Hẹn giờ</h1>
          <p className="page-sub">Lên lịch bật/tắt thiết bị tự động (GMT+7) · chỉ chạy khi thiết bị ở chế độ Tự động</p>
        </div>
        <button className="btn btn-primary" onClick={reset}>
          <Icon name="plus" size={17} /> Thêm lịch hẹn
        </button>
      </div>

      {list.error && <div className="alert-box alert-box-red">{list.error.message}</div>}

      <div className="split">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Danh sách lịch hẹn</h2>
            <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tất cả' }, { value: 'on', label: 'Đang bật' }, { value: 'off', label: 'Đã tắt' }]} />
          </div>
          {list.loading && !list.data ? (
            <Skeleton height={280} />
          ) : !items.length ? (
            <Empty title={filter === 'all' ? 'Chưa có lịch hẹn' : 'Không có lịch phù hợp'}>Tạo lịch ở khung bên cạnh.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thiết bị</th>
                    <th>Hành động</th>
                    <th>Thời gian</th>
                    <th className="hide-sm">Lặp lại</th>
                    <th className="hide-sm">Lần chạy tới</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => {
                    const c = home?.compById.get(s.component_id);
                    const d = describeCron(s.cron);
                    const v = s.action.value;
                    return (
                      <tr key={s._id} className={`clickable${f._id === s._id ? ' selected' : ''}`} onClick={() => edit(s)}>
                        <td>
                          <div className="sch-device">
                            {c && <MetricIcon metric={c.componentModel.metric} size={30} />}
                            <div>
                              <div>{c ? `${c.componentModel.label} · ${c.device_name}` : 'Thiết bị không còn'}</div>
                              <div className="small muted" style={{ fontWeight: 400 }}>{s.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge tone={s.action.mode === 'on' ? 'green' : 'amber'}>
                            {s.action.mode === 'on' ? (typeof v === 'number' ? `Bật ${v}${c?.componentModel.unit ?? ''}` : 'Bật') : 'Tắt'}
                          </Badge>
                          {v?.color && <span className="dev-color" style={{ background: v.color, marginLeft: 6, verticalAlign: 'middle' }} />}
                        </td>
                        <td className="mono" style={{ fontWeight: 600 }}>{d.time}</td>
                        <td className="hide-sm muted">{d.repeat}</td>
                        <td className="hide-sm muted">
                          {s.enabled ? fmtNextRun(s.next_run_at) : '—'}
                          {s.enabled && c && c.device_mode !== 'custom' && <div className="small" style={{ color: 'var(--amber)' }}>Sẽ bỏ qua: {DEVICE_MODES[c.device_mode].label}</div>}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="inline" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                            <button className="icon-btn" onClick={() => remove(s)} aria-label="Xóa lịch">
                              <Icon name="trash" size={16} />
                            </button>
                            <Toggle on={s.enabled} onChange={(on) => toggle(s, on)} label="Bật/tắt lịch" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{f._id ? 'Sửa lịch hẹn' : 'Thêm lịch hẹn'}</h2>
          </div>
          {!actuators.length && !homeLoading ? (
            <Empty title="Chưa có thiết bị chấp hành" action={<Link to="/thiet-bi">Đăng ký thiết bị</Link>} />
          ) : (
            <div className="stack">
              <Field label="Thiết bị" error={fields.component_id}>
                <select className="select" value={f.component_id} onChange={(e) => set('component_id', e.target.value)}>
                  {actuators.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.componentModel.label} · {a.device_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hành động">
                <div className="segmented" style={{ alignSelf: 'flex-start' }}>
                  <button type="button" className={f.mode === 'on' ? 'active' : ''} onClick={() => set('mode', 'on')}>Bật</button>
                  <button type="button" className={f.mode === 'off' ? 'active' : ''} onClick={() => set('mode', 'off')}>Tắt</button>
                </div>
              </Field>
              {f.mode === 'on' && cm?.metric === 'rgb_color' && (
                <Field label="Màu đèn">
                  <ColorSwatches value={f.color} colors={RGB_PALETTE} onChange={(c) => set('color', c)} />
                </Field>
              )}
              {f.mode === 'on' && cm && cm.metric !== 'rgb_color' && cm.type !== 'switch' && cm.range && (
                <Field label={`Mức: ${f.level}${cm.unit}`}>
                  <input type="range" className="slider" min={cm.range.min} max={cm.range.max} value={f.level} style={{ '--fill': `${f.level}%` }} onChange={(e) => set('level', Number(e.target.value))} />
                </Field>
              )}
              <Field label="Thời gian (GMT+7)" error={fields.cron}>
                <div className="time-box">
                  <input inputMode="numeric" maxLength={2} value={f.hh} aria-label="Giờ" onChange={(e) => set('hh', e.target.value.replace(/\D/g, '').slice(0, 2))} />
                  <span>:</span>
                  <input inputMode="numeric" maxLength={2} value={f.mm} aria-label="Phút" onChange={(e) => set('mm', e.target.value.replace(/\D/g, '').slice(0, 2))} />
                </div>
              </Field>
              <Field label="Lặp lại" error={fields.days}>
                <Segmented value={f.repeat} onChange={(v) => set('repeat', v)} options={[{ value: 'daily', label: 'Hằng ngày' }, { value: 'weekly', label: 'Theo thứ' }]} />
              </Field>
              {f.repeat === 'weekly' && (
                <div className="days">
                  {WEEKDAYS.map((w) => (
                    <button key={w.key} type="button" className={f.days.includes(w.key) ? 'on' : ''} onClick={() => toggleDay(w.key)}>
                      {w.short}
                    </button>
                  ))}
                </div>
              )}
              <Field label="Tên lịch / ghi chú" error={fields.name}>
                <input className="input" value={f.name} placeholder="VD: Bật đèn báo thức buổi sáng" onChange={(e) => set('name', e.target.value)} />
              </Field>
              {error && <div className="alert-box alert-box-red">{error}</div>}
              <div className="grid grid-2" style={{ gap: 12 }}>
                <button className="btn btn-soft" onClick={reset}>Hủy</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>Lưu lịch hẹn</button>
              </div>
            </div>
          )}
        </section>
      </div>
      {dialog}
    </div>
  );
}
