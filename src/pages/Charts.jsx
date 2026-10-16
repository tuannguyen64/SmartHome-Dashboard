import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/index.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { useHome } from '../hooks/useHome.js';
import { useToast } from '../context/ToastContext.jsx';
import { Icon } from '../components/icons.jsx';
import { Empty, Field, Segmented, Skeleton } from '../components/ui.jsx';
import { metricInfo, PARAMS } from '../utils/constants.js';
import { downloadText, fmtDateTime, fmtShortDateTime, fmtTime, fmtValue, toCsv, vnParts } from '../utils/format.js';

const RANGES = [
  { value: '1h', label: '1 giờ', ms: 3600e3 },
  { value: '6h', label: '6 giờ', ms: 6 * 3600e3 },
  { value: '24h', label: '24 giờ', ms: 86400e3 },
  { value: '7d', label: '7 ngày', ms: 7 * 86400e3 },
  { value: 'custom', label: 'Tùy chọn' },
];

const toLocalInput = (t) => {
  const p = vnParts(t);
  const z = (n) => String(n).padStart(2, '0');
  return `${p.year}-${z(p.month + 1)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
};
const fromLocalInput = (s) => {
  const [d, tm] = s.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = tm.split(':').map(Number);
  return Date.UTC(y, mo - 1, da, h - 7, mi);
};

function stats(items) {
  const vals = items.map((p) => p.value).filter((v) => v != null);
  if (!vals.length) return null;
  return { min: Math.min(...vals), max: Math.max(...vals), avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 };
}

// UC02-2 Xem biểu đồ lịch sử (sensor_readings của từng component)
export default function Charts() {
  const toast = useToast();
  const act = useAction();
  const { home, loading: homeLoading } = useHome();
  const rules = useApi(() => api.listRules().catch(() => []), []);
  const [range, setRange] = useState('24h');
  const [placeId, setPlaceId] = useState('');
  const [custom, setCustom] = useState(() => ({ from: toLocalInput(Date.now() - 2 * 86400e3), to: toLocalInput(Date.now()) }));
  const [win, setWin] = useState(() => ({ from: Date.now() - 86400e3, to: Date.now() }));
  const [customError, setCustomError] = useState(null);
  const [series, setSeries] = useState({});
  const [loading, setLoading] = useState(true);

  const rooms = useMemo(() => {
    if (!home) return [];
    const used = new Set(home.sensors.map((s) => s.place_id).filter((id) => home.paths.has(id)));
    return [...used].map((id) => ({ id, name: home.paths.get(id) }));
  }, [home]);
  const sensors = useMemo(() => (home?.sensors ?? []).filter((s) => !placeId || s.place_id === placeId), [home, placeId]);
  const key = sensors.map((s) => s._id).join();

  useEffect(() => {
    if (range === 'custom') return;
    const r = RANGES.find((x) => x.value === range);
    setWin({ from: Date.now() - r.ms, to: Date.now() });
  }, [range]);

  useEffect(() => {
    if (!sensors.length) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      sensors.map((s) =>
        act(() => api.deviceData(s.device_id, { componentModelId: s.componentModel._id, from: new Date(win.from).toISOString(), to: new Date(win.to).toISOString(), limit: 1000 }))
          .then((r) => [s._id, { items: r.items.map((p) => ({ t: new Date(p.ts).getTime(), value: p.value })), aggregated: r.aggregated }])
          .catch((e) => [s._id, { error: e.message }]),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setSeries(Object.fromEntries(entries));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, key]);

  const applyCustom = () => {
    const from = fromLocalInput(custom.from);
    const to = fromLocalInput(custom.to);
    if (!(from < to)) return setCustomError('Thời gian bắt đầu phải trước thời gian kết thúc.');
    if (from < Date.now() - PARAMS.RETENTION_DAYS * 86400e3) return setCustomError(`Hệ thống chỉ lưu dữ liệu ${PARAMS.RETENTION_DAYS} ngày gần nhất.`);
    setCustomError(null);
    setWin({ from, to: Math.min(to, Date.now()) });
  };

  const exportCsv = () => {
    const rows = [['Vị trí', 'Thiết bị', 'Đại lượng', 'Thời điểm (GMT+7)', 'Giá trị', 'Đơn vị']];
    sensors.forEach((s) =>
      (series[s._id]?.items ?? []).forEach((p) => {
        if (p.value != null) rows.push([home.paths.get(s.place_id) ?? '', s.device_name, s.componentModel.label, fmtDateTime(p.t), p.value, s.componentModel.unit]);
      }),
    );
    if (rows.length === 1) return toast.warn('Không có dữ liệu để xuất.');
    downloadText(`smarthome-${range}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  const thresholdsOf = (s) =>
    (rules.data ?? [])
      .filter((r) => r.enabled && r.component_id === s._id)
      .flatMap((r) => [r.min != null && { value: r.min, severity: r.severity }, r.max != null && { value: r.max, severity: r.severity }])
      .filter(Boolean);

  const span = win.to - win.from;
  const [main, ...rest] = sensors;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Biểu đồ</h1>
          <p className="page-sub">Lịch sử dữ liệu cảm biến lưu trong hệ thống · giờ GMT+7</p>
        </div>
        <div className="inline">
          {rooms.length > 1 && (
            <select className="select" style={{ width: 200 }} value={placeId} onChange={(e) => setPlaceId(e.target.value)} aria-label="Lọc theo vị trí">
              <option value="">Tất cả vị trí</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <Segmented value={range} onChange={setRange} options={RANGES} />
          <button className="btn btn-outline" onClick={exportCsv}>
            <Icon name="download" size={17} /> Xuất CSV
          </button>
        </div>
      </div>

      {range === 'custom' && (
        <div className="card">
          <div className="inline" style={{ alignItems: 'flex-end' }}>
            <Field label="Từ">
              <input className="input" type="datetime-local" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </Field>
            <Field label="Đến">
              <input className="input" type="datetime-local" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </Field>
            <button className="btn btn-primary" onClick={applyCustom}>Xem</button>
            {customError && <span className="field-error" style={{ fontSize: 14 }}>{customError}</span>}
          </div>
        </div>
      )}

      {homeLoading && !home ? (
        <Skeleton height={320} />
      ) : !sensors.length ? (
        <div className="card">
          <Empty title="Chưa có cảm biến">Đăng ký thiết bị có cảm biến ở mục Thiết bị.</Empty>
        </div>
      ) : (
        <>
          <div className="grid grid-3">
            {sensors.map((s) => (
              <StatCard key={s._id} comp={s} path={home.paths.get(s.place_id)} data={series[s._id]} loading={loading} />
            ))}
          </div>
          {main && <ChartCard comp={main} path={home.paths.get(main.place_id)} data={series[main._id]} thresholds={thresholdsOf(main)} loading={loading} span={span} win={win} height={300} />}
          {rest.length > 0 && (
            <div className="grid grid-2">
              {rest.map((s) => (
                <ChartCard key={s._id} comp={s} path={home.paths.get(s.place_id)} data={series[s._id]} thresholds={thresholdsOf(s)} loading={loading} span={span} win={win} height={220} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ comp, path, data, loading }) {
  const cm = comp.componentModel;
  const st = data?.items ? stats(data.items) : null;
  return (
    <div className="card">
      <div className="muted">
        {cm.label} TB · {path?.split(' › ').pop() ?? comp.device_name}
      </div>
      {loading && !data ? (
        <Skeleton height={34} width="45%" style={{ margin: '8px 0' }} />
      ) : (
        <div style={{ fontSize: 30, lineHeight: '40px', fontWeight: 700, margin: '4px 0' }} className="mono">
          {st ? `${fmtValue(cm.metric, st.avg)} ${cm.unit}` : '—'}
        </div>
      )}
      <div className="small muted">{st ? `Cao nhất ${fmtValue(cm.metric, st.max)} · Thấp nhất ${fmtValue(cm.metric, st.min)}` : 'Không có dữ liệu'}</div>
    </div>
  );
}

function ChartCard({ comp, path, data, thresholds, loading, span, win, height }) {
  const cm = comp.componentModel;
  const m = metricInfo(cm.metric);
  const fmtTick = (t) => (span <= 36 * 3600e3 ? fmtTime(t) : fmtShortDateTime(t).split(' ')[0]);
  const gid = `g-${comp._id}`;
  const hasData = data?.items?.some((p) => p.value != null);
  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <h2 className="card-title">
          {cm.label} ({cm.unit}) <span className="muted small">· {comp.device_name}{path ? ` · ${path.split(' › ').pop()}` : ''}</span>
        </h2>
        <div className="inline small muted" style={{ gap: 16 }}>
          <span className="inline" style={{ gap: 6 }}>
            <span style={{ width: 16, height: 3, background: m.color, borderRadius: 2 }} /> Giá trị
          </span>
          {thresholds.map((t, i) => (
            <span key={i} className="inline" style={{ gap: 6 }}>
              <span style={{ width: 16, borderTop: `2px dashed ${t.severity === 'danger' ? '#ef4444' : '#94a3b8'}` }} />
              Ngưỡng {t.value} {cm.unit}
            </span>
          ))}
          {data?.aggregated && <span>Đã gom điểm</span>}
        </div>
      </div>
      {loading && !data ? (
        <Skeleton height={height} />
      ) : data?.error ? (
        <div className="alert-box alert-box-red">{data.error}</div>
      ) : !hasData ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty>Không có dữ liệu trong khoảng này</Empty>
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.items} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={m.color} stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={[win.from, win.to]} tickFormatter={fmtTick} tick={{ fill: '#647896', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis tick={{ fill: '#647896', fontSize: 12 }} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
              <Tooltip labelFormatter={(t) => fmtDateTime(t)} formatter={(v) => [`${fmtValue(cm.metric, v)} ${cm.unit}`, cm.label]} contentStyle={{ borderRadius: 10, border: '1px solid #dfe7f2', fontSize: 13 }} />
              {thresholds.map((t, i) => (
                <ReferenceLine key={i} y={t.value} stroke={t.severity === 'danger' ? '#ef4444' : '#94a3b8'} strokeDasharray="6 5" ifOverflow="extendDomain" />
              ))}
              {/* connectNulls=false → đứt đoạn khi thiết bị mất dữ liệu */}
              <Area type="monotone" dataKey="value" stroke={m.color} strokeWidth={2.5} fill={`url(#${gid})`} connectNulls={false} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
