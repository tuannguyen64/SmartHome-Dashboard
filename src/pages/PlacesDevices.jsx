import { useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { useHome } from '../hooks/useHome.js';
import { DeviceIcon } from '../components/Device.jsx';
import { Icon } from '../components/icons.jsx';
import { Badge, Empty, Field, Modal, Skeleton, useConfirm } from '../components/ui.jsx';
import { CHILD_TYPES, DEVICE_MODES, PARENT_TYPES, PLACE_TYPES } from '../utils/constants.js';
import { timeAgo } from '../utils/format.js';

// Quản lý vị trí (places – cây nhà > tầng > phòng > khu vực) và thiết bị (đăng ký bằng mã, đổi tên, chuyển vị trí, gỡ)
export default function PlacesDevices() {
  const { user } = useAuth();
  const toast = useToast();
  const act = useAction();
  const [confirm, dialog] = useConfirm();
  const { home, loading, reload } = useHome();
  const models = useApi(() => api.listDeviceModels().catch(() => []), []);
  const [selected, setSelected] = useState('');
  const [placeForm, setPlaceForm] = useState(null); // { mode: 'create'|'edit', parent?, place? }
  const [deviceForm, setDeviceForm] = useState(null);
  const [register, setRegister] = useState(false);

  const places = (home?.places ?? []).filter((p) => p.owner_id === user._id);
  const children = (id) => places.filter((p) => p.parent_id === id).sort((a, b) => a.order - b.order);
  const roots = places.filter((p) => !p.parent_id || !places.some((x) => x._id === p.parent_id));
  const inSelected = (d) => {
    if (!selected) return true;
    const p = home.places.find((x) => x._id === d.place_id);
    return p && (p._id === selected || p.ancestors.includes(selected));
  };
  const devices = (home?.devices ?? []).filter(inSelected);
  const modelName = (id) => (models.data ?? []).find((m) => m._id === id)?.name;

  const removePlace = async (p) => {
    if (!(await confirm({ title: `Xóa "${p.name}"?`, message: 'Chỉ xóa được vị trí không còn vị trí con và không còn thiết bị.', danger: true, confirmText: 'Xóa' }))) return;
    try {
      await act(() => api.deletePlace(p._id));
      if (selected === p._id) setSelected('');
      reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const unregister = async (d) => {
    const ok = await confirm({
      title: `Gỡ đăng ký "${d.device_name}"?`,
      danger: true,
      confirmText: 'Gỡ đăng ký',
      message: 'Thiết bị trở về trạng thái chưa có chủ. Các quy tắc và lịch hẹn dùng thiết bị này sẽ bị tắt; dữ liệu lịch sử vẫn được giữ.',
    });
    if (!ok) return;
    try {
      await act(() => api.unregisterDevice(d._id));
      toast.success('Đã gỡ đăng ký thiết bị.');
      reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const Node = ({ p, depth }) => (
    <li>
      <div className={`tree-node${selected === p._id ? ' active' : ''}`} style={{ paddingLeft: 10 + depth * 18 }}>
        <button className="name" onClick={() => setSelected(selected === p._id ? '' : p._id)}>
          {p.name} <Badge tone="blue">{PLACE_TYPES[p.type]}</Badge>
        </button>
        {CHILD_TYPES[p.type].length > 0 && (
          <button className="icon-btn" title="Thêm vị trí con" onClick={() => setPlaceForm({ mode: 'create', parent: p })}>
            <Icon name="plus" size={15} />
          </button>
        )}
        <button className="icon-btn" title="Sửa" onClick={() => setPlaceForm({ mode: 'edit', place: p })}>
          <Icon name="pencil" size={15} />
        </button>
        <button className="icon-btn" title="Xóa" onClick={() => removePlace(p)}>
          <Icon name="trash" size={15} />
        </button>
      </div>
      {children(p._id).length > 0 && (
        <ul className="tree">
          {children(p._id).map((c) => <Node key={c._id} p={c} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Vị trí và thiết bị</h1>
          <p className="page-sub">Tạo nhà, tầng, phòng; đăng ký thiết bị bằng mã in trên bo</p>
        </div>
        <button className="btn btn-primary" onClick={() => setRegister(true)} disabled={!places.length}>
          <Icon name="plus" size={17} /> Đăng ký thiết bị
        </button>
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)' }}>
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Vị trí</h2>
            <button className="btn btn-outline btn-sm" onClick={() => setPlaceForm({ mode: 'create' })}>
              <Icon name="plus" size={15} /> Thêm nhà
            </button>
          </div>
          {loading && !home ? (
            <Skeleton height={200} />
          ) : !places.length ? (
            <Empty title="Chưa có vị trí">Bắt đầu bằng việc thêm một "Nhà", sau đó thêm tầng và phòng.</Empty>
          ) : (
            <>
              <div className={`tree-node${!selected ? ' active' : ''}`} style={{ paddingLeft: 10 }}>
                <button className="name" onClick={() => setSelected('')}>Tất cả thiết bị</button>
              </div>
              <ul className="tree">
                {roots.map((p) => <Node key={p._id} p={p} depth={0} />)}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{selected ? home.paths.get(selected) : 'Thiết bị của tôi'}</h2>
            <span className="muted">{devices.length} thiết bị</span>
          </div>
          {loading && !home ? (
            <Skeleton height={260} />
          ) : !devices.length ? (
            <Empty title="Chưa có thiết bị" action={places.length > 0 && <button className="btn btn-primary btn-sm" onClick={() => setRegister(true)}>Đăng ký thiết bị</button>}>
              Nhập mã đăng ký in trên bo để nhận thiết bị.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thiết bị</th>
                    <th className="hide-sm">Vị trí</th>
                    <th>Trạng thái</th>
                    <th className="hide-sm">Chế độ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => {
                    const mine = d.owner_id === user._id;
                    return (
                      <tr key={d._id}>
                        <td>
                          <div className="sch-device">
                            <DeviceIcon comps={home.compsOf(d._id)} size={30} />
                            <div>
                              <div>{d.device_name}</div>
                              <div className="small muted" style={{ fontWeight: 400 }}>
                                {modelName(d.device_model_id) ?? ''}
                                {!mine && ' · được chia sẻ'}
                                {mine && d.shared_with?.length > 0 && ` · chia sẻ ${d.shared_with.length} người`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hide-sm">{home.paths.get(d.place_id) ?? <span className="muted">—</span>}</td>
                        <td>
                          {d.online ? <Badge tone="green">online</Badge> : <Badge tone="gray">offline</Badge>}
                          <div className="small muted">tin cuối {timeAgo(d.last_seen)}</div>
                        </td>
                        <td className="hide-sm">{DEVICE_MODES[d.mode]?.label}</td>
                        <td>
                          {mine && (
                            <div className="inline" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end', gap: 2 }}>
                              <button className="icon-btn" onClick={() => setDeviceForm(d)} aria-label="Sửa thiết bị">
                                <Icon name="pencil" size={16} />
                              </button>
                              <button className="icon-btn" onClick={() => unregister(d)} aria-label="Gỡ đăng ký">
                                <Icon name="logout" size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {placeForm && <PlaceForm {...placeForm} places={places} paths={home.paths} onClose={() => setPlaceForm(null)} onDone={() => { setPlaceForm(null); reload({ silent: true }); }} />}
      {deviceForm && <DeviceForm device={deviceForm} places={places} paths={home.paths} onClose={() => setDeviceForm(null)} onDone={() => { setDeviceForm(null); reload({ silent: true }); }} />}
      {register && <RegisterForm places={places} paths={home.paths} defaultPlace={selected} onClose={() => setRegister(false)} onDone={() => { setRegister(false); reload({ silent: true }); }} />}
      {dialog}
    </div>
  );
}

function PlaceForm({ mode, parent, place, places, paths, onClose, onDone }) {
  const toast = useToast();
  const act = useAction();
  const types = mode === 'create' ? (parent ? CHILD_TYPES[parent.type] : ['home']) : [place.type];
  const [f, setF] = useState({ name: place?.name ?? '', type: types[0], parent_id: place?.parent_id ?? '' });
  const [error, setError] = useState(null);
  // Nơi chuyển tới hợp lệ: đúng cấp cha, không phải chính nó hay cây con
  const targets =
    mode === 'edit' && place.type !== 'home'
      ? places.filter((p) => PARENT_TYPES[place.type].includes(p.type) && p._id !== place._id && !p.ancestors.includes(place._id))
      : [];
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'create') await act(() => api.createPlace({ name: f.name, type: f.type, ...(parent && { parent_id: parent._id }) }));
      else await act(() => api.updatePlace(place._id, { name: f.name, ...(f.parent_id && f.parent_id !== place.parent_id && { parent_id: f.parent_id }) }));
      toast.success(mode === 'create' ? 'Đã thêm vị trí.' : 'Đã cập nhật.');
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal title={mode === 'create' ? (parent ? `Thêm vào "${parent.name}"` : 'Thêm nhà') : `Sửa: ${place.name}`} onClose={onClose} width={480}>
      <form className="stack" onSubmit={submit}>
        {mode === 'create' && types.length > 1 && (
          <Field label="Loại">
            <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {types.map((t) => <option key={t} value={t}>{PLACE_TYPES[t]}</option>)}
            </select>
          </Field>
        )}
        <Field label={`Tên ${PLACE_TYPES[f.type].toLowerCase()}`}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        {targets.length > 0 && (
          <Field label="Thuộc" hint="Vị trí con và thiết bị bên trong đi theo">
            <select className="select" value={f.parent_id} onChange={(e) => setF({ ...f, parent_id: e.target.value })}>
              {targets.map((p) => <option key={p._id} value={p._id}>{paths.get(p._id)}</option>)}
            </select>
          </Field>
        )}
        {error && <div className="alert-box alert-box-red">{error}</div>}
        <div className="modal-foot" style={{ marginTop: 6 }}>
          <button type="button" className="btn btn-soft" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary">Lưu</button>
        </div>
      </form>
    </Modal>
  );
}

function DeviceForm({ device, places, paths, onClose, onDone }) {
  const toast = useToast();
  const act = useAction();
  const [f, setF] = useState({ device_name: device.device_name, place_id: device.place_id ?? '' });
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await act(() => api.updateDevice(device._id, f));
      toast.success('Đã cập nhật thiết bị.');
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal title={`Sửa thiết bị: ${device.device_name}`} onClose={onClose} width={480}>
      <form className="stack" onSubmit={submit}>
        <Field label="Tên thiết bị">
          <input className="input" value={f.device_name} onChange={(e) => setF({ ...f, device_name: e.target.value })} autoFocus />
        </Field>
        <Field label="Vị trí" hint="Dữ liệu lịch sử giữ nguyên vị trí tại thời điểm đo">
          <select className="select" value={f.place_id} onChange={(e) => setF({ ...f, place_id: e.target.value })}>
            {places.map((p) => <option key={p._id} value={p._id}>{paths.get(p._id)}</option>)}
          </select>
        </Field>
        {error && <div className="alert-box alert-box-red">{error}</div>}
        <div className="modal-foot" style={{ marginTop: 6 }}>
          <button type="button" className="btn btn-soft" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary">Lưu</button>
        </div>
      </form>
    </Modal>
  );
}

function RegisterForm({ places, paths, defaultPlace, onClose, onDone }) {
  const toast = useToast();
  const act = useAction();
  const [f, setF] = useState({ registration_code: '', place_id: defaultPlace || places.find((p) => p.type === 'room')?._id || places[0]?._id || '', device_name: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFields({});
    setError(null);
    try {
      const d = await act(() => api.registerDevice({ ...f, device_name: f.device_name || undefined }));
      toast.success(`"${d.device_name}" đã thuộc về bạn.`, 'Đăng ký thành công');
      onDone();
    } catch (err) {
      setFields(err.details?.fields ?? {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Đăng ký thiết bị" onClose={onClose} width={500}>
      <form className="stack" onSubmit={submit}>
        <Field label="Mã đăng ký" hint="8 ký tự in trên bo, không phân biệt hoa/thường" error={fields.registration_code}>
          <input
            className="input mono"
            value={f.registration_code}
            maxLength={9}
            placeholder="ABCD2345"
            style={{ letterSpacing: '.15em', fontWeight: 600 }}
            onChange={(e) => setF({ ...f, registration_code: e.target.value.toUpperCase() })}
            autoFocus
          />
        </Field>
        <Field label="Đặt vào vị trí">
          <select className="select" value={f.place_id} onChange={(e) => setF({ ...f, place_id: e.target.value })}>
            {places.map((p) => <option key={p._id} value={p._id}>{paths.get(p._id)}</option>)}
          </select>
        </Field>
        <Field label="Tên thiết bị (tùy chọn)" hint="Bỏ trống để dùng tên mặc định">
          <input className="input" value={f.device_name} onChange={(e) => setF({ ...f, device_name: e.target.value })} />
        </Field>
        {error && <div className="alert-box alert-box-red">{error}</div>}
        <div className="modal-foot" style={{ marginTop: 6 }}>
          <button type="button" className="btn btn-soft" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={busy || !f.registration_code}>Đăng ký</button>
        </div>
      </form>
    </Modal>
  );
}
