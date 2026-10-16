import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { useHome } from '../hooks/useHome.js';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { MetricIcon } from '../components/Device.jsx';
import { Icon } from '../components/icons.jsx';
import { Badge, ColorSwatches, Empty, Field, Modal, RangeSlider, Skeleton, Toggle, useConfirm } from '../components/ui.jsx';
import { CHANNELS, COMMAND_STATUS, metricInfo, RGB_PALETTE, SEVERITY } from '../utils/constants.js';
import { fmtAction, fmtShortDateTime } from '../utils/format.js';

// Điều kiện của một threshold_rule, ví dụ "> 32 °C" hoặc "ngoài 18 – 32 °C"
function condition(rule, unit) {
  if (rule.min != null && rule.max != null) return `ngoài khoảng ${rule.min} – ${rule.max} ${unit}`;
  if (rule.max != null) return `> ${rule.max} ${unit}`;
  return `< ${rule.min} ${unit}`;
}

// UC05-1 Ngưỡng cảnh báo + UC04-2 Quy tắc tự động — cùng collection threshold_rules
export default function Automation() {
  const { home } = useHome();
  const rules = useApi(() => api.listRules(), []);
  const [editing, setEditing] = useState(null);
  const reload = () => rules.reload({ silent: true });
  const ctx = { home, reload };
  const autoRules = (rules.data ?? []).filter((r) => r.auto_action);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Tự động hóa</h1>
          <p className="page-sub">Ngưỡng cảnh báo và hành động tự động theo cảm biến (threshold_rules)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})} disabled={!home?.sensors.length}>
          <Icon name="plus" size={17} /> Thêm quy tắc
        </button>
      </div>

      {rules.error && <div className="alert-box alert-box-red">{rules.error.message}</div>}

      <div className="split-even">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Ngưỡng cảnh báo</h2>
              <p className="card-sub">Vượt ngưỡng 3 lần đo liên tiếp sẽ sinh cảnh báo. Dashboard luôn nhận thông báo.</p>
            </div>
          </div>
          {rules.loading && !rules.data ? (
            <Skeleton height={300} />
          ) : !rules.data?.length ? (
            <Empty title="Chưa có quy tắc nào">Bấm "Thêm quy tắc" để đặt ngưỡng cho cảm biến.</Empty>
          ) : (
            <div className="stack" style={{ gap: 0 }}>
              {rules.data.map((r) => (
                <ThresholdEditor key={r._id} rule={r} ctx={ctx} onEdit={() => setEditing(r)} />
              ))}
            </div>
          )}
        </section>

        <div className="stack" style={{ gap: 'var(--gap)' }}>
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Quy tắc tự động</h2>
                <p className="card-sub">Chỉ chạy khi thiết bị ở chế độ Tự động; thao tác tay được ưu tiên 15 phút.</p>
              </div>
              <span className="muted">{autoRules.filter((r) => r.enabled && r.auto_action.enabled).length} đang bật</span>
            </div>
            {!autoRules.length ? (
              <Empty title="Chưa có hành động tự động" action={<button className="btn btn-primary btn-sm" onClick={() => setEditing({ withAuto: true })} disabled={!home?.actuators.length}>Thêm quy tắc</button>} />
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                {autoRules.map((r) => (
                  <AutoRow key={r._id} rule={r} ctx={ctx} onEdit={() => setEditing(r)} />
                ))}
              </div>
            )}
          </section>
          <RuleHistory />
        </div>
      </div>

      {editing && <RuleForm initial={editing} ctx={ctx} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ cột trái: sửa nhanh ngưỡng

const draftOf = (r) => ({ min: r.min ?? '', max: r.max ?? '', telegram: r.channels.includes('telegram'), lcd: r.channels.includes('lcd') });

function ThresholdEditor({ rule, ctx, onEdit }) {
  const toast = useToast();
  const act = useAction();
  const [confirm, dialog] = useConfirm();
  const comp = ctx.home?.compById.get(rule.component_id);
  const cm = comp?.componentModel;
  const m = metricInfo(rule.metric);
  const [draft, setDraft] = useState(() => draftOf(rule));
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(draftOf(rule)), [rule]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(rule));
  const [smin, smax] = m.slider ?? [cm?.range?.min ?? 0, cm?.range?.max ?? 100];
  const num = (v) => (v === '' || v == null ? null : Number(v));

  const save = async (patch) => {
    setBusy(true);
    setFields({});
    try {
      const body = patch ?? {
        min: draft.min,
        max: draft.max,
        channels: ['dashboard', ...(draft.telegram ? ['telegram'] : []), ...(draft.lcd ? ['lcd'] : [])],
      };
      await act(() => api.saveRule({ ...rule, ...body }));
      toast.success(patch?.enabled === false ? 'Đã tắt quy tắc. Cảnh báo đang mở của quy tắc được đóng.' : 'Đã lưu quy tắc.');
      ctx.reload();
    } catch (e) {
      setFields(e.details?.fields ?? {});
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Xóa quy tắc?', message: `Xóa "${rule.name}". Lịch sử cảnh báo vẫn được giữ.`, danger: true, confirmText: 'Xóa' }))) return;
    try {
      await act(() => api.deleteRule(rule._id));
      ctx.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="th-item">
      <div className="th-head">
        <MetricIcon metric={rule.metric} size={30} />
        <div style={{ minWidth: 0 }}>
          <strong>{rule.name}</strong>
          <div className="small muted">{comp ? `${cm.label} · ${comp.device_name}` : 'Cảm biến không còn'}</div>
        </div>
        <Badge tone={SEVERITY[rule.severity].tone}>{SEVERITY[rule.severity].label}</Badge>
        <span className="spacer" />
        <button className="icon-btn" onClick={onEdit} aria-label="Sửa quy tắc">
          <Icon name="pencil" size={16} />
        </button>
        <button className="icon-btn" onClick={remove} aria-label="Xóa quy tắc">
          <Icon name="trash" size={16} />
        </button>
        <Toggle on={rule.enabled} onChange={(v) => save({ enabled: v })} disabled={busy} label="Bật/tắt quy tắc" />
      </div>
      <RangeSlider
        min={smin}
        max={smax}
        step={m.decimals ? 0.5 : 1}
        low={num(draft.min) == null ? null : Math.max(smin, Math.min(smax, num(draft.min)))}
        high={num(draft.max) == null ? null : Math.max(smin, Math.min(smax, num(draft.max)))}
        disabled={!rule.enabled}
        onChange={(lo, hi) => setDraft((d) => ({ ...d, min: lo ?? '', max: hi ?? '' }))}
      />
      <div className="grid grid-2" style={{ gap: 12 }}>
        {['min', 'max'].map((k) => (
          <Field key={k} label={k === 'min' ? 'Ngưỡng dưới' : 'Ngưỡng trên'} error={fields[k]}>
            <div className="input-suffix">
              <input className={`input${fields[k] ? ' invalid' : ''}`} type="number" placeholder="Không xét" value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
              <span>{cm?.unit}</span>
            </div>
          </Field>
        ))}
      </div>
      <div className="inline" style={{ gap: 8 }}>
        <span className="small muted">Kênh thông báo</span>
        <button className="chip on" disabled>✓ {CHANNELS.dashboard}</button>
        {['telegram', 'lcd'].map((ch) => (
          <button key={ch} className={`chip${draft[ch] ? ' on' : ''}`} onClick={() => setDraft((d) => ({ ...d, [ch]: !d[ch] }))}>
            {draft[ch] ? '✓ ' : ''}
            {CHANNELS[ch]}
          </button>
        ))}
        <span className="spacer" />
        {dirty && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => { setDraft(draftOf(rule)); setFields({}); }}>Hoàn tác</button>
            <button className="btn btn-primary btn-sm" onClick={() => save()} disabled={busy}>Lưu ngưỡng</button>
          </>
        )}
      </div>
      {dialog}
    </div>
  );
}

// ------------------------------------------------------------------ cột phải: hành động tự động

function AutoRow({ rule, ctx, onEdit }) {
  const toast = useToast();
  const act = useAction();
  const src = ctx.home?.compById.get(rule.component_id);
  const target = ctx.home?.compById.get(rule.auto_action.component_id);
  const on = rule.enabled && rule.auto_action.enabled;
  const toggle = async (v) => {
    try {
      await act(() => api.saveRule({ ...rule, enabled: v ? true : rule.enabled, auto_action: { ...rule.auto_action, enabled: v } }));
      ctx.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <div className={`rule${on ? '' : ' off'}`}>
      <MetricIcon metric={rule.metric} size={40} />
      <div className="rule-text">
        <div className="rule-if">
          <b>NẾU</b> {src?.componentModel.label ?? rule.metric} {condition(rule, src?.componentModel.unit ?? '')}
          <span className="muted">· {src?.device_name ?? '—'}</span>
          {rule.state?.auto_active && <Badge tone="blue">đang kích hoạt</Badge>}
        </div>
        <div className="rule-then">
          <b>THÌ</b> {target ? `${fmtAction(target.componentModel, rule.auto_action.on_breach)} (${target.device_name})` : 'Thiết bị không còn'}
          {rule.auto_action.on_resolve && ` · khi bình thường: ${fmtAction(target?.componentModel, rule.auto_action.on_resolve)}`}
        </div>
        {target && target.device_mode !== 'custom' && <div className="small" style={{ color: 'var(--amber)' }}>Thiết bị đang ở chế độ ép bật/tắt – quy tắc tạm ngừng</div>}
      </div>
      <button className="icon-btn" onClick={onEdit} aria-label="Sửa quy tắc">
        <Icon name="pencil" size={17} />
      </button>
      <Toggle on={on} onChange={toggle} label="Bật/tắt hành động tự động" />
    </div>
  );
}

function RuleHistory() {
  const history = useApi(() => api.listCommands({ source: 'automation', limit: 6 }).catch(() => ({ items: [] })), []);
  const { home } = useHome();
  useLiveEvent('command', (c) => c.source === 'automation' && history.reload({ silent: true }));
  const items = history.data?.items ?? [];
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Lịch sử kích hoạt</h2>
        <Link to="/lich-su?source=automation">Xem tất cả</Link>
      </div>
      {history.loading && !history.data ? (
        <Skeleton height={160} />
      ) : !items.length ? (
        <Empty>Quy tắc chưa kích hoạt lần nào.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Quy tắc</th>
                <th className="hide-sm">Lệnh</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c._id}>
                  <td className="nowrap mono">{fmtShortDateTime(c.sent_at)}</td>
                  <td>{c.ref_name ?? '—'}</td>
                  <td className="hide-sm muted">{fmtAction(home?.compById.get(c.component_id)?.componentModel, c.payload)}</td>
                  <td>
                    <span title={c.reason ?? ''}>
                      <Badge tone={COMMAND_STATUS[c.status].tone}>{COMMAND_STATUS[c.status].label}</Badge>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ form đầy đủ

function RuleForm({ initial, ctx, onClose }) {
  const toast = useToast();
  const act = useAction();
  const [confirm, dialog] = useConfirm();
  const isNew = !initial._id;
  const sensors = ctx.home?.sensors ?? [];
  const actuators = ctx.home?.actuators ?? [];
  const paths = ctx.home?.paths ?? new Map();
  const aa = initial.auto_action;
  const [f, setF] = useState(() => ({
    name: initial.name ?? '',
    component_id: initial.component_id ?? sensors[0]?._id ?? '',
    min: initial.min ?? '',
    max: initial.max ?? '',
    severity: initial.severity ?? 'warning',
    telegram: initial.channels?.includes('telegram') ?? false,
    lcd: initial.channels?.includes('lcd') ?? false,
    enabled: initial.enabled ?? true,
    auto: aa?.enabled ?? !!initial.withAuto,
    target: aa?.component_id ?? actuators[0]?._id ?? '',
    breachMode: aa?.on_breach?.mode ?? 'on',
    breachLevel: typeof aa?.on_breach?.value === 'number' ? aa.on_breach.value : 70,
    breachColor: aa?.on_breach?.value?.color ?? '#ffcc00',
    resolveOff: aa ? aa.on_resolve?.mode === 'off' : true,
  }));
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const src = sensors.find((s) => s._id === f.component_id);
  const target = actuators.find((a) => a._id === f.target);
  const tcm = target?.componentModel;
  const label = (c) => `${c.componentModel.label} · ${c.device_name}${paths.get(c.place_id) ? ` (${paths.get(c.place_id).split(' › ').pop()})` : ''}`;
  const lightOnLamp = src?.componentModel.metric === 'light' && tcm?.metric === 'rgb_color' && f.auto;

  const submit = async () => {
    setFields({});
    setError(null);
    const breachValue = tcm?.metric === 'rgb_color' ? { color: f.breachColor, pixels: [0, 1, 2, 3] } : tcm?.type === 'switch' ? tcm.range?.max ?? 1 : Number(f.breachLevel);
    try {
      const res = await act(() =>
        api.saveRule({
          _id: initial._id,
          name: f.name,
          component_id: f.component_id,
          min: f.min,
          max: f.max,
          severity: f.severity,
          channels: ['dashboard', ...(f.telegram ? ['telegram'] : []), ...(f.lcd ? ['lcd'] : [])],
          enabled: f.enabled,
          auto_action: f.auto
            ? {
                enabled: true,
                component_id: f.target,
                on_breach: f.breachMode === 'on' ? { mode: 'on', value: breachValue } : { mode: 'off' },
                on_resolve: f.resolveOff ? { mode: f.breachMode === 'on' ? 'off' : 'on' } : null,
              }
            : aa
              ? { ...aa, enabled: false }
              : null,
        }),
      );
      toast.success(isNew ? 'Đã tạo quy tắc. Áp dụng từ bản đo kế tiếp.' : 'Đã lưu quy tắc.');
      if (res.warning) toast.warn(res.warning, 'Lưu ý');
      ctx.reload();
      onClose();
    } catch (e) {
      setFields(e.details?.fields ?? {});
      setError(e.message);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Xóa quy tắc?', message: `Xóa "${initial.name}". Lịch sử vẫn được giữ.`, danger: true, confirmText: 'Xóa' }))) return;
    try {
      await act(() => api.deleteRule(initial._id));
      ctx.reload();
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      title={isNew ? 'Thêm quy tắc' : `Sửa quy tắc: ${initial.name}`}
      onClose={onClose}
      width={660}
      footer={
        <>
          {!isNew && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}>
              <Icon name="trash" size={16} /> Xóa
            </button>
          )}
          <button className="btn btn-soft" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={submit}>Lưu</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Tên quy tắc" error={fields.name} className="full">
          <input className="input" value={f.name} placeholder="VD: Nóng phòng khách" onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Cảm biến theo dõi" error={fields.component_id} className="full">
          <select className="select" value={f.component_id} onChange={(e) => set('component_id', e.target.value)}>
            {sensors.map((s) => <option key={s._id} value={s._id}>{label(s)}</option>)}
          </select>
        </Field>
        <Field label={`Ngưỡng dưới (${src?.componentModel.unit ?? ''})`} error={fields.min} hint="Để trống nếu không xét">
          <input className="input" type="number" value={f.min} onChange={(e) => set('min', e.target.value)} />
        </Field>
        <Field label={`Ngưỡng trên (${src?.componentModel.unit ?? ''})`} error={fields.max} hint="Để trống nếu không xét">
          <input className="input" type="number" value={f.max} onChange={(e) => set('max', e.target.value)} />
        </Field>
        <Field label="Mức độ">
          <div className="inline">
            {Object.entries(SEVERITY).map(([k, v]) => (
              <label key={k} className="check">
                <input type="radio" name="sev" checked={f.severity === k} onChange={() => set('severity', k)} /> {v.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Kênh thông báo">
          <div className="inline">
            <label className="check"><input type="checkbox" checked disabled /> Dashboard</label>
            <label className="check"><input type="checkbox" checked={f.telegram} onChange={(e) => set('telegram', e.target.checked)} /> Telegram</label>
            <label className="check"><input type="checkbox" checked={f.lcd} onChange={(e) => set('lcd', e.target.checked)} /> Tại chỗ</label>
          </div>
        </Field>

        <div className="full" style={{ borderTop: '1.5px solid var(--line)', paddingTop: 14 }}>
          <label className="check" style={{ fontWeight: 500 }}>
            <input type="checkbox" checked={f.auto} disabled={!actuators.length} onChange={(e) => set('auto', e.target.checked)} />
            Tự động điều khiển thiết bị khi vượt ngưỡng (auto_action)
          </label>
        </div>
        {f.auto && (
          <>
            <Field label="Thiết bị chấp hành" error={fields.target} className="full">
              <select className="select" value={f.target} onChange={(e) => set('target', e.target.value)}>
                {actuators.map((a) => <option key={a._id} value={a._id}>{label(a)}</option>)}
              </select>
            </Field>
            <Field label="Khi vượt ngưỡng">
              <div className="segmented" style={{ alignSelf: 'flex-start' }}>
                <button type="button" className={f.breachMode === 'on' ? 'active' : ''} onClick={() => set('breachMode', 'on')}>Bật</button>
                <button type="button" className={f.breachMode === 'off' ? 'active' : ''} onClick={() => set('breachMode', 'off')}>Tắt</button>
              </div>
            </Field>
            <Field label="Khi trở lại bình thường">
              <label className="check" style={{ height: 40 }}>
                <input type="checkbox" checked={f.resolveOff} onChange={(e) => set('resolveOff', e.target.checked)} />
                Hoàn tác ({f.breachMode === 'on' ? 'tắt' : 'bật'} lại)
              </label>
            </Field>
            {f.breachMode === 'on' && tcm?.metric === 'rgb_color' && (
              <Field label="Màu đèn" className="full">
                <ColorSwatches value={f.breachColor} colors={RGB_PALETTE} onChange={(c) => set('breachColor', c)} />
              </Field>
            )}
            {f.breachMode === 'on' && tcm && tcm.metric !== 'rgb_color' && tcm.type !== 'switch' && tcm.range && (
              <Field label={`Mức: ${f.breachLevel}${tcm.unit}`} className="full">
                <input type="range" className="slider" min={tcm.range.min} max={tcm.range.max} value={f.breachLevel} style={{ '--fill': `${f.breachLevel}%` }} onChange={(e) => set('breachLevel', Number(e.target.value))} />
                {tcm.min_start != null && f.breachLevel < tcm.min_start && <span className="small" style={{ color: 'var(--amber)' }}>Dưới {tcm.min_start}{tcm.unit} thiết bị có thể không chạy.</span>}
              </Field>
            )}
            {lightOnLamp && (
              <div className="alert-box alert-box-amber full">Đèn bật có thể làm cảm biến ánh sáng đọc sáng hơn và gây bật/tắt liên tục.</div>
            )}
          </>
        )}
        <div className="full">
          <label className="check">
            <input type="checkbox" checked={f.enabled} onChange={(e) => set('enabled', e.target.checked)} /> Bật quy tắc
          </label>
        </div>
      </div>
      {error && <div className="alert-box alert-box-red" style={{ marginTop: 14 }}>{error}</div>}
      {dialog}
    </Modal>
  );
}
