import { useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { Badge, Empty, Field, Segmented, Skeleton } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import { downloadText } from '../utils/format.js';
import './developer.css';

const SECTIONS = [
  { value: 'models', label: 'Mẫu thiết bị' },
  { value: 'components', label: 'Loại linh kiện' },
  { value: 'types', label: 'Loại thiết bị' },
];

export default function DeveloperCatalog() {
  const [section, setSection] = useState('models');
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const toast = useToast();
  const act = useAction();
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

  return (
    <div className="page developer-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Developer workspace</h1>
          <p className="page-sub">Tra cứu danh mục phần cứng và xuất cấu hình mẫu cho firmware.</p>
        </div>
        <Badge tone="blue" dot>Developer tools</Badge>
      </div>

      <div className="developer-summary">
        <article className="card developer-summary-card">
          <span>Mẫu thiết bị</span><strong>{models.data?.length ?? '—'}</strong>
        </article>
        <article className="card developer-summary-card">
          <span>Loại linh kiện</span><strong>{components.data?.length ?? '—'}</strong>
        </article>
        <article className="card developer-summary-card">
          <span>Loại thiết bị</span><strong>{types.data?.length ?? '—'}</strong>
        </article>
      </div>

      <section className="card developer-catalog">
        <div className="card-head developer-catalog-head">
          <div>
            <h2 className="card-title">Danh mục phần cứng</h2>
            <p className="card-sub">Dữ liệu được đọc từ API; công cụ này không sửa cấu hình backend.</p>
          </div>
          <Segmented value={section} onChange={changeSection} options={SECTIONS} />
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
                      <div><h3>{item.name}</h3><span>{modelType?.name ?? 'Chưa phân loại'}{modelType?.code ? ` · ${modelType.code}` : ''}</span></div>
                      <Badge tone="blue">{modelComponents.length} linh kiện</Badge>
                    </div>
                    <p className="developer-item-description">{item.description || 'Chưa có mô tả cho mẫu thiết bị này.'}</p>
                    <div className="developer-chips">
                      {modelComponents.map((component) => <span key={component._id}>{component.label || component.name}</span>)}
                      {!modelComponents.length && <span>Chưa khai báo linh kiện</span>}
                    </div>
                    <div className="developer-item-foot">
                      <span className="developer-mono">Nút: {item.buttons || 'Không có'}</span>
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
                  </article>
                );
              }
              return (
                <article className="developer-item developer-type-item" key={item._id}>
                  <div className="developer-item-top">
                    <div><h3>{item.name}</h3><span>{item.code || 'Chưa có mã'}</span></div>
                    <Badge tone="gray">Loại thiết bị</Badge>
                  </div>
                  <p className="developer-mono">ID: {item._id}</p>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty title="Không có kết quả phù hợp">Thử đổi từ khóa tìm kiếm hoặc bộ lọc.</Empty>
        )}
      </section>
    </div>
  );
}
