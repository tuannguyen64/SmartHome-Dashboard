import { useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { Badge, Empty, Field, Modal, Segmented, Skeleton, useConfirm } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { downloadText } from '../utils/format.js';
import './developer.css';

const SECTIONS = [
  { value: 'models', label: 'Mẫu thiết bị' },
  { value: 'components', label: 'Linh kiện' },
  { value: 'types', label: 'Loại thiết bị' },
];
const NOUN = { models: 'mẫu thiết bị', components: 'linh kiện', types: 'loại thiết bị' };

// Danh mục phần cứng (admin + developer): xem, thêm, sửa, xóa loại thiết bị / linh kiện / mẫu thiết bị
export default function DeveloperCatalog({ embedded = false }) {
  const { user } = useAuth();
  const [section, setSection] = useState('models');
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const [editing, setEditing] = useState(null); // { section, item | null }
  const toast = useToast();
  const act = useAction();
  const [confirm, dialog] = useConfirm();
  const types = useApi(() => api.listTypes(), []);
  const components = useApi(() => api.listComponentModels(), []);
  const models = useApi(() => api.listDeviceModels(), []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    const list = section === 'models' ? models.data ?? [] : section === 'components' ? components.data ?? [] : types.data ?? [];
    return list.filter((item) => {
      const typeMatch = !typeId || item.type_id === typeId;
      const searchable = [item.name, item.label, item.code, item.driver, item.metric, item.description].filter(Boolean).join(' ').toLocaleLowerCase('vi');
      return typeMatch && (!query || searchable.includes(query));
    });
  }, [section, search, typeId, models.data, components.data, types.data]);

  const loading = models.loading || components.loading || types.loading;
  const errors = [models.error, components.error, types.error].filter(Boolean);
  const componentById = useMemo(() => new Map((components.data ?? []).map((item) => [item._id, item])), [components.data]);
  const typeById = useMemo(() => new Map((types.data ?? []).map((item) => [item._id, item])), [types.data]);
  // Developer chỉ được thêm / sửa / xóa mẫu thiết bị; linh kiện và loại thiết bị do admin quản lý
  const canEdit = (kind) => user?.role === 'admin' || kind === 'models';
  const reloadAll = () => Promise.all([types.reload({ silent: true }), components.reload({ silent: true }), models.reload({ silent: true })]);

  const changeSection = (value) => {
    setSection(value);
    setSearch('');
    setTypeId('');
  };

  const exportModel = async (model) => {
    setExportingId(model._id);
    try {
      const config = await act(() => api.exportDeviceModel(model._id));
      downloadText(`${model.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-firmware.json`, JSON.stringify(config, null, 2), 'application/json;charset=utf-8');
      toast.success(`Đã xuất cấu hình firmware cho "${model.name}".`);
    } catch (error) {
      toast.error(error.message || 'Không thể xuất cấu hình firmware.');
    } finally {
      setExportingId(null);
    }
  };

  const remove = async (kind, item) => {
    const name = item.label || item.name;
    if (!(await confirm({ title: `Xóa ${NOUN[kind]}?`, message: `Xóa "${name}" khỏi danh mục. Không xóa được nếu đang có thiết bị hoặc mẫu dùng tới.`, danger: true, confirmText: 'Xóa' }))) return;
    const fn = kind === 'models' ? api.deleteDeviceModel : kind === 'components' ? api.deleteComponentModel : api.deleteType;
    try {
      await act(() => fn(item._id));
      toast.success(`Đã xóa "${name}".`);
      reloadAll();
    } catch (error) {
      toast.error(error.message || 'Không thể xóa.');
    }
  };

  const itemActions = (kind, item) => (
    <div className="inline developer-item-actions">
      <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditing({ section: kind, item })}><Icon name="pencil" size={14} /> Sửa</button>
      <button className="btn btn-ghost btn-sm developer-danger" type="button" onClick={() => remove(kind, item)}><Icon name="trash" size={14} /> Xóa</button>
    </div>
  );

  return (
    <div className={embedded ? undefined : 'page developer-page'}>
      {!embedded && (
        <div className="page-head">
          <div>
            <h1 className="page-title">Danh mục phần cứng</h1>
            <p className="page-sub">Quản lý loại thiết bị, linh kiện và mẫu thiết bị dùng để cấp thiết bị mới.</p>
          </div>
          <Badge tone="blue" dot>{user?.role === 'admin' ? 'Quản trị viên' : 'Developer'}</Badge>
        </div>
      )}

      <div className="developer-summary">
        <article className="card developer-summary-card">
          <span>Mẫu thiết bị</span><strong>{models.data?.length ?? '—'}</strong>
        </article>
        <article className="card developer-summary-card">
          <span>Linh kiện</span><strong>{components.data?.length ?? '—'}</strong>
        </article>
        <article className="card developer-summary-card">
          <span>Loại thiết bị</span><strong>{types.data?.length ?? '—'}</strong>
        </article>
      </div>

      <section className="card developer-catalog">
        <div className="card-head developer-catalog-head">
          <Segmented value={section} onChange={changeSection} options={SECTIONS} />
          {canEdit(section) ? (
            <button className="btn btn-primary" type="button" onClick={() => setEditing({ section, item: null })}>
              <Icon name="plus" size={16} /> Thêm {NOUN[section]}
            </button>
          ) : (
            <span className="muted small">Chỉ quản trị viên được thêm, sửa {NOUN[section]}</span>
          )}
        </div>

        <div className="developer-filters">
          <Field label="Tìm trong danh mục">
            <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, driver, metric..." />
          </Field>
          {section === 'models' && (
            <Field label="Loại thiết bị">
              <select className="select" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                <option value="">Tất cả loại thiết bị</option>
                {(types.data ?? []).map((type) => <option key={type._id} value={type._id}>{type.name}</option>)}
              </select>
            </Field>
          )}
        </div>

        {errors.map((error) => <div key={error.code + error.message} className="alert-box alert-box-red" role="alert">{error.message}</div>)}
        {loading && !models.data ? (
          <div className="developer-card-grid">{[1, 2, 3].map((item) => <Skeleton key={item} height={180} />)}</div>
        ) : filtered.length ? (
          <div className="developer-card-grid">
            {filtered.map((item) => {
              if (section === 'models') {
                const modelType = typeById.get(item.type_id);
                const modelComponents = (item.components ?? []).map((id) => componentById.get(id)).filter(Boolean);
                return (
                  <article className="developer-item" key={item._id}>
                    <div className="developer-item-top">
                      <div><h3>{item.name}</h3><span>{modelType?.name ?? 'Chưa phân loại'}</span></div>
                      <Badge tone="blue">{modelComponents.length} linh kiện</Badge>
                    </div>
                    <p className="developer-item-description">{item.description || 'Chưa có mô tả cho mẫu thiết bị này.'}</p>
                    <div className="developer-chips">
                      {modelComponents.map((component) => <span key={component._id}>{component.label || component.name}</span>)}
                      {!modelComponents.length && <span>Chưa khai báo linh kiện</span>}
                    </div>
                    <span className="developer-mono">Nút trên bo: {item.buttons || 'Không có'}</span>
                    <div className="developer-item-foot">
                      {itemActions('models', item)}
                      <button className="btn btn-primary btn-sm" type="button" disabled={exportingId === item._id} onClick={() => exportModel(item)}>
                        <Icon name="download" size={15} /> {exportingId === item._id ? 'Đang xuất…' : 'Xuất JSON'}
                      </button>
                    </div>
                  </article>
                );
              }
              if (section === 'components') {
                return (
                  <article className="developer-item" key={item._id}>
                    <div className="developer-item-top">
                      <div><h3>{item.label || item.name}</h3><span className="developer-mono">{item.name}</span></div>
                      <Badge tone={item.kind === 'sensor' ? 'green' : 'amber'}>{item.kind === 'sensor' ? 'Cảm biến' : 'Chấp hành'}</Badge>
                    </div>
                    <dl className="developer-properties">
                      <div><dt>Driver</dt><dd>{item.driver || '—'}</dd></div>
                      <div><dt>Metric</dt><dd>{item.metric || '—'}</dd></div>
                      <div><dt>Đơn vị</dt><dd>{item.unit || '—'}</dd></div>
                      <div><dt>Khoảng đo</dt><dd>{item.range ? `${item.range.min} – ${item.range.max} ${item.unit || ''}` : '—'}</dd></div>
                    </dl>
                    {item.description && <p className="developer-item-description">{item.description}</p>}
                    {canEdit('components') && <div className="developer-item-foot">{itemActions('components', item)}</div>}
                  </article>
                );
              }
              const used = (models.data ?? []).filter((model) => model.type_id === item._id).length;
              return (
                <article className="developer-item developer-type-item" key={item._id}>
                  <div className="developer-item-top">
                    <div><h3>{item.name}</h3><span>{used} mẫu thiết bị</span></div>
                    <Badge tone="gray">Loại thiết bị</Badge>
                  </div>
                  {canEdit('types') && <div className="developer-item-foot">{itemActions('types', item)}</div>}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty title="Không có kết quả phù hợp">Thử đổi từ khóa tìm kiếm hoặc bộ lọc.</Empty>
        )}
      </section>

      {editing?.section === 'types' && <TypeForm item={editing.item} onClose={() => setEditing(null)} onSaved={reloadAll} />}
      {editing?.section === 'components' && <ComponentForm item={editing.item} onClose={() => setEditing(null)} onSaved={reloadAll} />}
      {editing?.section === 'models' && (
        <DeviceModelForm item={editing.item} types={types.data ?? []} components={components.data ?? []} onClose={() => setEditing(null)} onSaved={reloadAll} />
      )}
      {dialog}
    </div>
  );
}

// Khung form dùng chung: lưu, báo lỗi theo trường, đóng khi xong
function useSave({ onSaved, onClose, label }) {
  const act = useAction();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const save = async (fn) => {
    setBusy(true);
    setErrors({});
    try {
      await act(fn);
      toast.success(`Đã lưu ${label}.`);
      onSaved();
      onClose();
    } catch (error) {
      setErrors(error.details?.fields ?? {});
      toast.error(error.message || 'Không lưu được.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, save };
}

const FormFooter = ({ busy, onClose, form }) => (
  <>
    <button className="btn btn-soft" type="button" onClick={onClose}>Hủy</button>
    <button className="btn btn-primary" type="submit" form={form} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
  </>
);

function TypeForm({ item, onClose, onSaved }) {
  const [name, setName] = useState(item?.name ?? '');
  const { busy, errors, save } = useSave({ onSaved, onClose, label: 'loại thiết bị' });
  const submit = (event) => {
    event.preventDefault();
    save(() => (item ? api.updateType(item._id, { name: name.trim() }) : api.createType({ name: name.trim() })));
  };
  return (
    <Modal title={item ? 'Sửa loại thiết bị' : 'Thêm loại thiết bị'} onClose={onClose} width={440} footer={<FormFooter busy={busy} onClose={onClose} form="type-form" />}>
      <form id="type-form" className="stack" onSubmit={submit}>
        <Field label="Tên loại thiết bị" error={errors.name}>
          <input className="input" required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Quạt, Đèn, Rèm" />
        </Field>
      </form>
    </Modal>
  );
}

const numOrNull = (value) => (value === '' || value == null ? null : Number(value));

function ComponentForm({ item, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    name: item?.name ?? '',
    label: item?.label ?? '',
    kind: item?.kind ?? 'sensor',
    driver: item?.driver ?? '',
    metric: item?.metric ?? '',
    unit: item?.unit ?? '',
    min: item?.range?.min ?? 0,
    max: item?.range?.max ?? 100,
    min_start: item?.min_start ?? '',
    type: item?.type ?? 'slider',
    description: item?.description ?? '',
  }));
  const set = (key) => (event) => setF((current) => ({ ...current, [key]: event.target.value }));
  const { busy, errors, save } = useSave({ onSaved, onClose, label: 'linh kiện' });
  const actuator = f.kind === 'actuator';
  const submit = (event) => {
    event.preventDefault();
    const body = {
      name: f.name.trim(),
      label: f.label.trim(),
      kind: f.kind,
      driver: f.driver.trim(),
      metric: f.metric.trim(),
      unit: f.unit.trim(),
      range: { min: Number(f.min), max: Number(f.max) },
      min_start: actuator ? numOrNull(f.min_start) : null,
      type: actuator ? f.type : null,
      description: f.description.trim(),
    };
    save(() => (item ? api.updateComponentModel(item._id, body) : api.createComponentModel(body)));
  };
  return (
    <Modal title={item ? 'Sửa linh kiện' : 'Thêm linh kiện'} onClose={onClose} width={620} footer={<FormFooter busy={busy} onClose={onClose} form="component-form" />}>
      <form id="component-form" className="form-grid" onSubmit={submit}>
        <Field label="Tên hiển thị" error={errors.label}>
          <input className="input" required value={f.label} onChange={set('label')} placeholder="Ví dụ: Nhiệt độ DHT20" />
        </Field>
        <Field label="Mã (tên feed MQTT)" error={errors.name} hint="Chữ thường, số và dấu '-'">
          <input className="input" required pattern="[a-z0-9-]+" value={f.name} onChange={set('name')} placeholder="dht20-temp" />
        </Field>
        <Field label="Loại">
          <select className="select" value={f.kind} onChange={set('kind')}>
            <option value="sensor">Cảm biến</option>
            <option value="actuator">Chấp hành</option>
          </select>
        </Field>
        <Field label="Driver trên firmware" error={errors.driver} hint="Chữ thường, số và dấu '_'">
          <input className="input" required pattern="[a-z0-9_]+" value={f.driver} onChange={set('driver')} placeholder="dht20_temp" />
        </Field>
        <Field label="Metric" error={errors.metric}>
          <input className="input" required value={f.metric} onChange={set('metric')} placeholder="temperature" />
        </Field>
        <Field label="Đơn vị" error={errors.unit}>
          <input className="input" required value={f.unit} onChange={set('unit')} placeholder="°C" />
        </Field>
        <Field label="Giá trị nhỏ nhất" error={errors.range}>
          <input className="input" type="number" step="any" required value={f.min} onChange={set('min')} />
        </Field>
        <Field label="Giá trị lớn nhất">
          <input className="input" type="number" step="any" required value={f.max} onChange={set('max')} />
        </Field>
        {actuator && (
          <>
            <Field label="Kiểu điều khiển" error={errors.type}>
              <select className="select" value={f.type} onChange={set('type')}>
                <option value="slider">Thanh trượt (mức)</option>
                <option value="switch">Công tắc (bật/tắt)</option>
              </select>
            </Field>
            <Field label="Mức tối thiểu để chạy" hint="Để trống nếu không cần">
              <input className="input" type="number" step="any" value={f.min_start} onChange={set('min_start')} />
            </Field>
          </>
        )}
        <Field label="Mô tả" className="full">
          <textarea className="input" rows={2} value={f.description} onChange={set('description')} />
        </Field>
      </form>
    </Modal>
  );
}

function DeviceModelForm({ item, types, components, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    name: item?.name ?? '',
    type_id: item?.type_id ?? types[0]?._id ?? '',
    description: item?.description ?? '',
    components: item?.components ?? [],
    buttons: item?.buttons ?? '',
  }));
  const { busy, errors, save } = useSave({ onSaved, onClose, label: 'mẫu thiết bị' });
  const chosen = components.filter((component) => f.components.includes(component._id));
  const buttonOptions = chosen.filter((component) => component.kind === 'actuator');
  const toggle = (id) => setF((current) => {
    const next = current.components.includes(id) ? current.components.filter((x) => x !== id) : [...current.components, id];
    const stillOk = components.some((component) => next.includes(component._id) && component.name === current.buttons && component.kind === 'actuator');
    return { ...current, components: next, buttons: stillOk ? current.buttons : '' };
  });
  const submit = (event) => {
    event.preventDefault();
    const body = { name: f.name.trim(), type_id: f.type_id, description: f.description.trim(), components: f.components, buttons: f.buttons || null };
    save(() => (item ? api.updateDeviceModel(item._id, body) : api.createDeviceModel(body)));
  };
  const group = (kind) => components.filter((component) => component.kind === kind);
  return (
    <Modal title={item ? 'Sửa mẫu thiết bị' : 'Thêm mẫu thiết bị'} onClose={onClose} width={640} footer={<FormFooter busy={busy} onClose={onClose} form="device-model-form" />}>
      <form id="device-model-form" className="form-grid" onSubmit={submit}>
        <Field label="Tên mẫu" error={errors.name}>
          <input className="input" required value={f.name} onChange={(event) => setF({ ...f, name: event.target.value })} placeholder="Ví dụ: Quạt phòng khách v2" />
        </Field>
        <Field label="Loại thiết bị" error={errors.type_id}>
          <select className="select" required value={f.type_id} onChange={(event) => setF({ ...f, type_id: event.target.value })}>
            {!types.length && <option value="">Chưa có loại thiết bị</option>}
            {types.map((type) => <option key={type._id} value={type._id}>{type.name}</option>)}
          </select>
        </Field>
        <div className="full developer-check-groups">
          {[['sensor', 'Cảm biến'], ['actuator', 'Chấp hành']].map(([kind, title]) => (
            <fieldset key={kind} className="developer-check-group">
              <legend>{title}</legend>
              {group(kind).map((component) => (
                <label key={component._id} className="developer-check">
                  <input type="checkbox" checked={f.components.includes(component._id)} onChange={() => toggle(component._id)} />
                  <span>{component.label || component.name}<small>{component.name}</small></span>
                </label>
              ))}
              {!group(kind).length && <span className="muted small">Chưa có linh kiện loại này</span>}
            </fieldset>
          ))}
          {errors.components && <span className="field-error">{errors.components}</span>}
        </div>
        <Field label="Nút A/B trên bo điều khiển" hint="Chọn linh kiện chấp hành mà nút bấm sẽ bật/tắt">
          <select className="select" value={f.buttons} onChange={(event) => setF({ ...f, buttons: event.target.value })}>
            <option value="">Không dùng nút</option>
            {buttonOptions.map((component) => <option key={component._id} value={component.name}>{component.label || component.name}</option>)}
          </select>
        </Field>
        <Field label="Linh kiện đã chọn">
          <div className="developer-chips">{chosen.length ? chosen.map((component) => <span key={component._id}>{component.label || component.name}</span>) : <span>Chưa chọn</span>}</div>
        </Field>
        <Field label="Mô tả" className="full">
          <textarea className="input" rows={2} value={f.description} onChange={(event) => setF({ ...f, description: event.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}
