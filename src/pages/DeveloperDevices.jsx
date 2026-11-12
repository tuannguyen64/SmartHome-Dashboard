import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { Badge, Empty, Field, Modal, Pagination, Skeleton } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { downloadText, fmtDateTime, toCsv } from '../utils/format.js';
import './developer.css';

const PAGE_SIZE = 12;

export default function DeveloperDevices() {
  const [filters, setFilters] = useState({ search: '', registered: '', status: '', type_id: '', page: 1 });
  const [provision, setProvision] = useState({ device_model_id: '', quantity: 1 });
  const [created, setCreated] = useState(null);
  const toast = useToast();
  const act = useAction();
  const models = useApi(() => api.listDeviceModels(), []);
  const devices = useApi(
    () => api.listDevices({ ...filters, limit: PAGE_SIZE }),
    [filters.search, filters.registered, filters.status, filters.type_id, filters.page],
  );
  const modelById = useMemo(() => new Map((models.data ?? []).map((model) => [model._id, model])), [models.data]);
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));

  const createDevices = async (event) => {
    event.preventDefault();
    try {
      const items = await act(() => api.cloneDevices({
        device_model_id: provision.device_model_id || models.data?.[0]?._id,
        quantity: Number(provision.quantity),
      }));
      setCreated(items);
      toast.success(`Đã cấp ${items.length} thiết bị theo mẫu.`);
      devices.reload({ silent: true });
    } catch (error) {
      toast.error(error.message || 'Không thể cấp thiết bị.');
    }
  };

  const exportCodes = (items) => downloadText(
    'smarthome-device-registration-codes.csv',
    toCsv([
      ['Tên thiết bị', 'Mẫu thiết bị', 'Mã đăng ký', 'Device ID'],
      ...items.map((device) => [
        device.device_name,
        modelById.get(device.device_model_id)?.name ?? device.model_name ?? '',
        device.registration_code ?? '',
        device._id,
      ]),
    ]),
  );

  return (
    <div className="page developer-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Triển khai thiết bị</h1>
          <p className="page-sub">Cấp mã đăng ký theo mẫu, theo dõi trạng thái triển khai và mở chẩn đoán từng thiết bị.</p>
        </div>
        <Badge tone="blue" dot>Provisioning</Badge>
      </div>

      <form className="card developer-provision-form" onSubmit={createDevices}>
        <div className="card-head">
          <div>
            <h2 className="card-title">Cấp thiết bị mới</h2>
            <p className="card-sub">Mỗi thiết bị được tạo sẽ có mã đăng ký riêng và cấu hình linh kiện theo mẫu.</p>
          </div>
        </div>
        {models.error && <div className="alert-box alert-box-red" role="alert">{models.error.message}</div>}
        <div className="developer-provision-fields">
          <Field label="Mẫu thiết bị">
            <select
              className="select"
              required
              value={provision.device_model_id}
              onChange={(event) => setProvision((current) => ({ ...current, device_model_id: event.target.value }))}
            >
              <option value="">Chọn mẫu thiết bị</option>
              {(models.data ?? []).map((model) => <option key={model._id} value={model._id}>{model.name}</option>)}
            </select>
          </Field>
          <Field label="Số lượng (1–50)">
            <input
              className="input"
              type="number"
              min="1"
              max="50"
              required
              value={provision.quantity}
              onChange={(event) => setProvision((current) => ({ ...current, quantity: event.target.value }))}
            />
          </Field>
          <button className="btn btn-primary" type="submit" disabled={!models.data?.length}>
            <Icon name="plus" size={16} /> Cấp thiết bị
          </button>
        </div>
      </form>

      <section className="card developer-inventory">
        <div className="card-head developer-inventory-head">
          <div>
            <h2 className="card-title">Kho thiết bị</h2>
            <p className="card-sub">{devices.data ? `${devices.data.total} thiết bị trong danh mục` : 'Đang tải danh sách thiết bị'}</p>
          </div>
          <button className="btn btn-outline btn-sm" type="button" disabled={!devices.data?.items.length} onClick={() => exportCodes(devices.data.items)}>
            <Icon name="download" size={15} /> Xuất mã CSV
          </button>
        </div>

        <div className="developer-filters">
          <Field label="Tìm thiết bị">
            <input className="input" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Tên, chủ sở hữu hoặc ID..." />
          </Field>
          <Field label="Đăng ký">
            <select className="select" value={filters.registered} onChange={(event) => setFilter('registered', event.target.value)}>
              <option value="">Tất cả</option>
              <option value="false">Chưa đăng ký</option>
              <option value="true">Đã đăng ký</option>
            </select>
          </Field>
          <Field label="Kết nối">
            <select className="select" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
              <option value="">Mọi trạng thái</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="unregistered">Chưa đăng ký</option>
            </select>
          </Field>
          <Field label="Mẫu / loại">
            <select className="select" value={filters.type_id} onChange={(event) => setFilter('type_id', event.target.value)}>
              <option value="">Tất cả loại thiết bị</option>
              {(devices.data?.filters.types ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </Field>
        </div>

        {devices.error && <div className="alert-box alert-box-red" role="alert">{devices.error.message}</div>}
        {devices.loading && !devices.data ? <Skeleton height={320} /> : !devices.data?.items.length ? (
          <Empty title="Không tìm thấy thiết bị">Thử xóa bộ lọc hoặc tạo thiết bị từ một mẫu.</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table developer-device-table">
                <thead><tr><th>Thiết bị</th><th>Mẫu / loại</th><th>Chủ sở hữu</th><th>Trạng thái</th><th>Mã đăng ký</th><th>Tin cuối</th><th /></tr></thead>
                <tbody>
                  {devices.data.items.map((device) => (
                    <tr key={device._id}>
                      <td><strong>{device.device_name}</strong><span className="admin-log-id">ID {device._id.slice(-8)}</span></td>
                      <td>{device.model_name ?? modelById.get(device.device_model_id)?.name ?? '—'}<span className="admin-log-id">{device.type_name ?? 'Chưa phân loại'}</span></td>
                      <td>{device.owner_name ?? <span className="muted">Chưa đăng ký</span>}</td>
                      <td>{!device.owner_id ? <Badge tone="gray">Chưa đăng ký</Badge> : device.online ? <Badge tone="green" dot>Online</Badge> : <Badge tone="red" dot>Offline</Badge>}</td>
                      <td>{device.registration_code ? <code className="code-chip">{device.registration_code}</code> : '—'}</td>
                      <td className="muted nowrap">{device.last_seen ? fmtDateTime(device.last_seen) : 'Chưa có'}</td>
                      <td><Link className="btn btn-outline btn-sm" to={`/developer/diagnostics/${device._id}`}>Chẩn đoán</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={devices.data.page} pageSize={devices.data.limit} total={devices.data.total} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </>
        )}
      </section>

      {created && (
        <Modal
          title={`Đã cấp ${created.length} thiết bị`}
          onClose={() => setCreated(null)}
          width={600}
          footer={<button className="btn btn-primary" type="button" onClick={() => exportCodes(created)}><Icon name="download" size={16} /> Tải mã CSV</button>}
        >
          <p className="muted">Gán mã đăng ký cho thiết bị/bo mạch tương ứng. Mỗi mã chỉ dùng để đăng ký một thiết bị.</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Thiết bị</th><th>Mã đăng ký</th></tr></thead>
              <tbody>{created.map((device) => <tr key={device._id}><td>{device.device_name}</td><td><code className="code-chip">{device.registration_code}</code></td></tr>)}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
