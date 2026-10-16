import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApi } from '../hooks/useApi.js';
import { useHome } from '../hooks/useHome.js';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { Badge, Empty, Field, Pagination, Skeleton } from '../components/ui.jsx';
import { COMMAND_SOURCES, COMMAND_STATUS } from '../utils/constants.js';
import { fmtAction, fmtDateTime } from '../utils/format.js';

const LIMIT = 12;
const dayStart = (d) => (d ? new Date(`${d}T00:00:00+07:00`).toISOString() : undefined);
const dayEnd = (d) => (d ? new Date(`${d}T23:59:59+07:00`).toISOString() : undefined);
const EMPTY = { device_id: '', source: '', status: '', from: '', to: '' };

// UC03-3 Xem lịch sử điều khiển (collection commands)
export default function ControlHistory() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ ...EMPTY, source: params.get('source') ?? '' });
  const [pg, setPg] = useState(1);
  const { home } = useHome();
  const list = useApi(
    () => api.listCommands({ ...filters, from: dayStart(filters.from), to: dayEnd(filters.to), page: pg, limit: LIMIT }),
    [JSON.stringify(filters), pg],
  );
  const timer = useRef(null);
  useLiveEvent('command', () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => list.reload({ silent: true }), 400);
  });

  const setF = (k, v) => {
    setPg(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };
  const hasFilter = Object.values(filters).some(Boolean);
  const comp = (id) => home?.compById.get(id);
  const who = (c) => {
    if (c.source === 'dashboard') return c.issued_by ? 'Người dùng' : '—';
    return c.ref_name ?? '—';
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Lịch sử điều khiển</h1>
          <p className="page-sub">Mọi lệnh gửi tới thiết bị, nguồn phát lệnh và kết quả – mới nhất trước</p>
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <Field label="Thiết bị">
            <select className="select" value={filters.device_id} onChange={(e) => setF('device_id', e.target.value)}>
              <option value="">Tất cả</option>
              {(home?.devices ?? []).map((d) => <option key={d._id} value={d._id}>{d.device_name}</option>)}
            </select>
          </Field>
          <Field label="Nguồn">
            <select className="select" value={filters.source} onChange={(e) => setF('source', e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(COMMAND_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Kết quả">
            <select className="select" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(COMMAND_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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

      <section className="card">
        {list.error ? (
          <div className="alert-box alert-box-red">{list.error.message}</div>
        ) : list.loading && !list.data ? (
          <Skeleton height={400} />
        ) : !list.data?.items.length ? (
          <Empty title={hasFilter ? 'Không có lệnh phù hợp bộ lọc' : 'Chưa có lệnh điều khiển nào'} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th className="hide-sm">Thiết bị</th>
                    <th>Lệnh</th>
                    <th>Nguồn</th>
                    <th>Kết quả</th>
                    <th className="hide-sm">Độ trễ</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((c) => {
                    // backend thật trả component_model_id thay vì component_id
                    const k = comp(c.component_id) ?? home?.components.find((x) => x.device_id === c.device_id && x.componentModel._id === c.component_model_id);
                    return (
                      <tr key={c._id}>
                        <td className="mono hist-time">{fmtDateTime(c.sent_at)}</td>
                        <td className="hide-sm">{home?.deviceById.get(c.device_id)?.device_name ?? 'Thiết bị'}</td>
                        <td>
                          {fmtAction(k?.componentModel, c.payload)}
                          <div className="small muted show-sm">{home?.deviceById.get(c.device_id)?.device_name ?? 'Thiết bị'}</div>
                        </td>
                        <td>
                          <div>{COMMAND_SOURCES[c.source] ?? c.source}</div>
                          <div className="small muted">{who(c)}</div>
                        </td>
                        <td>
                          <Badge tone={COMMAND_STATUS[c.status]?.tone ?? 'gray'}>{COMMAND_STATUS[c.status]?.label ?? c.status ?? '—'}</Badge>
                          {c.reason && <div className="small muted" style={{ marginTop: 3 }}>{c.reason}</div>}
                        </td>
                        <td className="hide-sm mono muted">{c.latency_ms != null ? `${(c.latency_ms / 1000).toFixed(1)} s` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={pg} pageSize={LIMIT} total={list.data.total} onPage={setPg} />
          </>
        )}
      </section>
    </div>
  );
}
