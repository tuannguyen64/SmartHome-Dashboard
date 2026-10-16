import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, USE_MOCK } from '../api/index.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { useHome } from '../hooks/useHome.js';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Badge, Empty, Field, Pagination, Skeleton, Spinner } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { ALERT_STATUS, ALERT_TYPES, CHANNELS, METRICS, PARAMS, SEVERITY } from '../utils/constants.js';
import { fmtDateTime, fmtShortDateTime, fmtThreshold } from '../utils/format.js';
import { alertTone } from '../utils/status.js';

const DELIVERY = {
  sent: { label: 'Đã gửi', tone: 'green' },
  failed: { label: 'Thất bại', tone: 'red' },
  queued: { label: 'Đang chờ', tone: 'amber' },
  skipped: { label: 'Bỏ qua', tone: 'gray' },
};
const dayStart = (d) => (d ? new Date(`${d}T00:00:00+07:00`).toISOString() : undefined);
const dayEnd = (d) => (d ? new Date(`${d}T23:59:59+07:00`).toISOString() : undefined);
const EMPTY = { place_id: '', metric: '', severity: '', status: '', from: '', to: '' };

// UC05-2 Xem lịch sử và xác nhận cảnh báo (collection alerts)
export default function Alerts() {
  const toast = useToast();
  const act = useAction();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({ ...EMPTY, status: params.get('status') ?? '' });
  const [pg, setPg] = useState(1);
  const selectedId = params.get('id');
  const { home } = useHome();
  const list = useApi(
    () => api.listAlerts({ ...filters, from: dayStart(filters.from), to: dayEnd(filters.to), page: pg, limit: 10 }),
    [JSON.stringify(filters), pg],
    { poll: USE_MOCK ? 0 : PARAMS.POLL_MS },
  );
  const [detail, setDetail] = useState(null);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    if (!selectedId) return setDetail(null);
    act(() => api.getAlert(selectedId)).then(setDetail).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useLiveEvent('alert', (a) => {
    list.reload({ silent: true });
    if (a._id === selectedId) setDetail((d) => ({ ...d, ...a }));
  });

  const setF = (k, v) => {
    setPg(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };
  const select = (id) => {
    const p = new URLSearchParams(params);
    if (id) p.set('id', id);
    else p.delete('id');
    setParams(p, { replace: true });
  };

  const acknowledge = async () => {
    setAcking(true);
    try {
      setDetail(await act(() => api.acknowledgeAlert(detail._id)));
      toast.success('Hệ thống ngừng nhắc lại cảnh báo này.', 'Đã xác nhận');
      list.reload({ silent: true });
    } catch (e) {
      if (e.details?.alert) setDetail(e.details.alert); // A3: người khác đã xác nhận trước
      toast.warn(e.message);
    } finally {
      setAcking(false);
    }
  };

  const paths = home?.paths ?? new Map();
  const deviceName = (id) => home?.deviceById.get(id)?.device_name ?? 'Thiết bị';
  const comp = (id) => home?.compById.get(id);
  const hasFilter = Object.values(filters).some(Boolean);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Cảnh báo</h1>
          <p className="page-sub">Lịch sử cảnh báo, kết quả gửi thông báo và xác nhận đã biết</p>
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <Field label="Vị trí">
            <select className="select" value={filters.place_id} onChange={(e) => setF('place_id', e.target.value)}>
              <option value="">Tất cả</option>
              {[...paths.entries()].map(([id, p]) => <option key={id} value={id}>{p}</option>)}
            </select>
          </Field>
          <Field label="Đại lượng">
            <select className="select" value={filters.metric} onChange={(e) => setF('metric', e.target.value)}>
              <option value="">Tất cả</option>
              {['temperature', 'humidity', 'light'].map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
            </select>
          </Field>
          <Field label="Mức độ">
            <select className="select" value={filters.severity} onChange={(e) => setF('severity', e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select className="select" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(ALERT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Từ ngày">
            <input className="input" type="date" value={filters.from} onChange={(e) => setF('from', e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input className="input" type="date" value={filters.to} onChange={(e) => setF('to', e.target.value)} />
          </Field>
          {hasFilter && <button className="btn btn-ghost btn-sm" onClick={() => { setPg(1); setFilters(EMPTY); }}>Xóa lọc</button>}
        </div>
      </div>

      {list.error && <div className="alert-box alert-box-red">{list.error.message}</div>}

      <div className="split">
        <section className="card">
          {list.loading && !list.data ? (
            <Skeleton height={360} />
          ) : !list.data?.items.length ? (
            <Empty title={hasFilter ? 'Không có cảnh báo phù hợp bộ lọc' : 'Chưa có cảnh báo nào'} />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cảnh báo</th>
                      <th className="hide-sm">Vị trí</th>
                      <th>Mức độ</th>
                      <th>Trạng thái</th>
                      <th className="hide-sm">Thời điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.items.map((a) => (
                      <tr key={a._id} className={`clickable${a._id === selectedId ? ' selected' : ''}`} onClick={() => select(a._id)}>
                        <td>
                          <div className="alert-row-title inline" style={{ gap: 8, flexWrap: 'nowrap' }}>
                            <span className={`dot dot-${alertTone(a)}`} />
                            {!a.seen && <span className="unseen" title="Chưa xem" />}
                            {ALERT_TYPES[a.type]}
                          </div>
                          <div className="small muted" style={{ marginLeft: 18 }}>{a.message}</div>
                        </td>
                        <td className="hide-sm">{paths.get(a.place_id)?.split(' › ').pop() ?? '—'}</td>
                        <td><Badge tone={SEVERITY[a.severity].tone}>{SEVERITY[a.severity].label}</Badge></td>
                        <td><Badge tone={ALERT_STATUS[a.status].tone}>{ALERT_STATUS[a.status].label}</Badge></td>
                        <td className="hide-sm nowrap mono muted">{fmtShortDateTime(a.triggered_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pg} pageSize={10} total={list.data.total} onPage={setPg} />
            </>
          )}
        </section>

        <section className="card alert-detail">
          {!detail ? (
            <Empty title="Chọn một cảnh báo">để xem giá trị đo, ngưỡng bị vi phạm và kết quả gửi của từng kênh.</Empty>
          ) : (
            <div className="stack">
              <div className="card-head" style={{ marginBottom: 0 }}>
                <h2 className="card-title">{ALERT_TYPES[detail.type]}</h2>
                <button className="icon-btn" onClick={() => select(null)} aria-label="Đóng chi tiết">
                  <Icon name="x" />
                </button>
              </div>
              <div className="inline">
                <Badge tone={SEVERITY[detail.severity].tone}>{SEVERITY[detail.severity].label}</Badge>
                <Badge tone={ALERT_STATUS[detail.status].tone}>{ALERT_STATUS[detail.status].label}</Badge>
              </div>
              <p>{detail.message}</p>
              <dl>
                <dt>Phát sinh</dt>
                <dd>{fmtDateTime(detail.triggered_at)}</dd>
                {detail.place_id && (<><dt>Vị trí</dt><dd>{paths.get(detail.place_id) ?? '—'}</dd></>)}
                {detail.device_ids?.length > 0 && (<><dt>Thiết bị</dt><dd>{detail.device_ids.map(deviceName).join(', ')}</dd></>)}
                {detail.value != null && (
                  <>
                    <dt>Giá trị đo</dt>
                    <dd>
                      {detail.value} {comp(detail.component_id)?.componentModel.unit}
                      {detail.worst_value != null && detail.worst_value !== detail.value && ` (xấu nhất ${detail.worst_value})`}
                    </dd>
                  </>
                )}
                {detail.threshold && (
                  <>
                    <dt>Ngưỡng</dt>
                    <dd>
                      {fmtThreshold(detail.threshold.min, detail.threshold.max, comp(detail.component_id)?.componentModel.unit)} · vi phạm {detail.threshold.breached === 'max' ? 'ngưỡng trên' : 'ngưỡng dưới'}
                    </dd>
                  </>
                )}
                {detail.acknowledged_at && (<><dt>Xác nhận bởi</dt><dd>{detail.acknowledged_by_name ?? '—'} · {fmtDateTime(detail.acknowledged_at)}</dd></>)}
                {detail.resolved_at && (<><dt>Đã đóng</dt><dd>{fmtDateTime(detail.resolved_at)}{detail.resolve_reason && ` · ${detail.resolve_reason}`}</dd></>)}
                {detail.reminded_at && (<><dt>Nhắc lại</dt><dd>{fmtDateTime(detail.reminded_at)}</dd></>)}
              </dl>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Kết quả gửi (deliveries)</div>
                <div className="stack-sm">
                  {detail.deliveries.map((d, i) => (
                    <div key={i} className="inline" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', fontSize: 14 }}>
                      <span>
                        {CHANNELS[d.channel] ?? d.channel}
                        {d.note && <span className="muted"> · {d.note}</span>}
                        {d.last_error && <div className="small muted">{d.last_error}</div>}
                      </span>
                      <Badge tone={DELIVERY[d.status]?.tone ?? 'gray'}>
                        {DELIVERY[d.status]?.label ?? d.status}
                        {d.attempts > 1 ? ` · ${d.attempts} lần` : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              {detail.status === 'active' && (
                <button className="btn btn-primary btn-block" onClick={acknowledge} disabled={acking}>
                  {acking ? <Spinner /> : <Icon name="check" size={17} />} Đã biết
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
