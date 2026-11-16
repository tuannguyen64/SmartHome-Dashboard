import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { Badge, Empty, Field, Modal, Pagination, Skeleton, useConfirm } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { downloadText, fmtDateTime, toCsv } from '../utils/format.js';
import './developer.css';

const PAGE_SIZE = 12;

// Kho thiết bị (admin + developer): cấp thiết bị theo mẫu, xem chi tiết, đổi tên, gỡ chủ, xóa
export default function DeveloperDevices() {
  const { user } = useAuth();
  const base = user?.role === 'developer' ? '/developer' : '/admin';
  const [filters, setFilters] = useState({ search: '', registered: '', status: '', type_id: '', place_id: '', page: 1 });
  const [renaming, setRenaming] = useState(null);
  const [confirm, dialog] = useConfirm();
  const [provision, setProvision] = useState({ device_model_id: '', quantity: 1 });
  const [created, setCreated] = useState(null);
  const toast = useToast();
  const act = useAction();
  const models = useApi(() => api.listDeviceModels(), []);
  const devices = useApi(
    () => api.listDevices({ ...filters, limit: PAGE_SIZE }),
    [filters.search, filters.registered, filters.status, filters.type_id, filters.place_id, filters.page],
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

  const runAction = async (fn, message) => {
    try {
      await act(fn);
      toast.success(message);
      devices.reload({ silent: true });
      return true;
    } catch (error) {
      toast.error(error.message || 'Thao tác không thành công.');
      return false;
    }
  };

  const unregister = async (device) => {
    if (!(await confirm({
      title: 'Gỡ thiết bị khỏi chủ sở hữu?',
      message: `"${device.device_name}" sẽ trở về trạng thái chưa đăng ký và có thể đăng ký lại bằng mã. Quy tắc và lịch hẹn của thiết bị bị xóa.`,
      confirmText: 'Gỡ khỏi chủ',
      danger: true,
    }))) return;
    runAction(() => api.unregisterDevice(device._id), `Đã gỡ "${device.device_name}" khỏi chủ sở hữu.`);
  };

  const remove = async (device) => {
    if (!(await confirm({
      title: 'Xóa thiết bị?',
      message: `Xóa hẳn "${device.device_name}" khỏi kho, kèm quy tắc và lịch hẹn liên quan. Không hoàn tác được.`,
      confirmText: 'Xóa thiết bị',
      danger: true,
    }))) return;
    runAction(() => api.deleteDevice(device._id), `Đã xóa "${device.device_name}".`);
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
          <h1 className="page-title">Thiết bị</h1>
          <p className="page-sub">Cấp thiết bị mới theo mẫu, theo dõi trạng thái và quản lý từng thiết bị trong kho.</p>
        </div>
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
          <Field label="Loại thiết bị">
            <select className="select" value={filters.type_id} onChange={(event) => setFilter('type_id', event.target.value)}>
              <option value="">Tất cả loại thiết bị</option>
              {(devices.data?.filters?.types ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </Field>
          <Field label="Vị trí">
            <select className="select" value={filters.place_id} onChange={(event) => setFilter('place_id', event.target.value)}>
              <option value="">Mọi vị trí</option>
              {(devices.data?.filters?.places ?? []).map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
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
                <thead><tr><th>Thiết bị</th><th>Mẫu / loại</th><th>Chủ sở hữu</th><th>Vị trí</th><th>Trạng thái</th><th>Mã đăng ký</th><th>Tin cuối</th><th /></tr></thead>
                <tbody>
                  {devices.data.items.map((device) => (
                    <tr key={device._id}>
                      <td><strong>{device.device_name}</strong><span className="admin-log-id">ID {device._id.slice(-8)}</span></td>
                      <td>{device.model_name ?? modelById.get(device.device_model_id)?.name ?? '—'}<span className="admin-log-id">{device.type_name ?? 'Chưa phân loại'}</span></td>
                      <td>{device.owner_id ? <><strong>{device.owner_name ?? 'Người dùng'}</strong>{device.owner_username && <span className="admin-log-id">@{device.owner_username}</span>}</> : <span className="muted">Chưa đăng ký</span>}</td>
                      <td>{device.place_path ?? '—'}</td>
                      <td>{!device.owner_id ? <Badge tone="gray">Chưa đăng ký</Badge> : device.online ? <Badge tone="green" dot>Online</Badge> : <Badge tone="red" dot>Offline</Badge>}</td>
                      <td>{device.registration_code ? <code className="code-chip">{device.registration_code}</code> : '—'}</td>
                      <td className="muted nowrap">{device.last_seen ? fmtDateTime(device.last_seen) : 'Chưa có'}</td>
                      <td>
                        <div className="developer-row-actions">
                          <Link className="btn btn-outline btn-sm" to={`${base}/devices/${device._id}`}>Chi tiết</Link>
                          <button className="icon-btn" type="button" title="Đổi tên" aria-label={`Đổi tên ${device.device_name}`} onClick={() => setRenaming({ id: device._id, name: device.device_name })}><Icon name="pencil" size={16} /></button>
                          {device.owner_id && <button className="icon-btn" type="button" title="Gỡ khỏi chủ sở hữu" aria-label={`Gỡ ${device.device_name} khỏi chủ sở hữu`} onClick={() => unregister(device)}><Icon name="link" size={16} /></button>}
                          <button className="icon-btn developer-danger" type="button" title="Xóa thiết bị" aria-label={`Xóa ${device.device_name}`} onClick={() => remove(device)}><Icon name="trash" size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={devices.data.page} pageSize={devices.data.limit} total={devices.data.total} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </>
        )}
      </section>

      {renaming && (
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
          <form
            id="rename-device-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await runAction(() => api.updateDevice(renaming.id, { device_name: renaming.name.trim() }), 'Đã đổi tên thiết bị.')) setRenaming(null);
            }}
          >
            <Field label="Tên thiết bị">
              <input className="input" required autoFocus value={renaming.name} onChange={(event) => setRenaming({ ...renaming, name: event.target.value })} />
            </Field>
          </form>
        </Modal>
      )}
      {dialog}

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
