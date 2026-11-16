import { useEffect, useState } from 'react';
import { api, USE_MOCK } from '../api/index.js';
import { Badge, Field, Skeleton } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAction, useApi } from '../hooks/useApi.js';
import './admin.css';

const DEFAULTS = {
  offline_after_seconds: 60,
  alert_cooldown_minutes: 10,
  remind_after_minutes: 15,
  audit_retention_days: 180,
};
const FIELD_INFO = [
  { key: 'offline_after_seconds', label: 'Thời gian xác định thiết bị offline', unit: 'giây', min: 30, max: 3600 },
  { key: 'alert_cooldown_minutes', label: 'Thời gian chờ trước khi tạo lại cảnh báo', unit: 'phút', min: 1, max: 1440 },
  { key: 'remind_after_minutes', label: 'Nhắc lại cảnh báo chưa xác nhận sau', unit: 'phút', min: 1, max: 1440 },
  { key: 'audit_retention_days', label: 'Thời gian lưu audit log', unit: 'ngày', min: 30, max: 3650 },
];
const CHANNELS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'lcd', label: 'LCD / bo mạch' },
];

export default function AdminSettings() {
  const toast = useToast();
  const act = useAction();
  const settings = useApi(() => api.getAdminSettings(), []);
  const overview = useApi(() => api.adminOverview(), []);
  const [values, setValues] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [testingChannel, setTestingChannel] = useState('');

  useEffect(() => {
    if (settings.data) setValues(settings.data);
  }, [settings.data]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const saved = await act(() => api.updateAdminSettings(values));
      setValues(saved);
      settings.reload({ silent: true });
      overview.reload({ silent: true });
      toast.success('Cấu hình cảnh báo đã được lưu và áp dụng.');
    } catch (saveError) {
      setFieldErrors(saveError.details?.fields ?? {});
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateAlertRule = (metric, update) =>
    setValues((current) => ({
      ...current,
      alert_rules: current.alert_rules.map((rule) => (rule.metric === metric ? { ...rule, ...update } : rule)),
    }));

  const testChannel = async (rule, channel) => {
    const key = `${rule.metric}:${channel}`;
    setTestingChannel(key);
    try {
      const result = await act(() => api.testAdminAlertChannel(rule.metric, channel));
      toast.success(`Đã kiểm tra kênh ${CHANNELS.find((item) => item.id === channel)?.label}. ${result.status === 'simulated' ? 'Mock không gửi ra dịch vụ thật.' : ''}`);
    } catch (testError) {
      toast.error(testError.message);
    } finally {
      setTestingChannel('');
    }
  };

  return (
    <div className="page admin-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Cấu hình Cảnh báo & Server</h1>
          <p className="page-sub">Điều chỉnh chính sách cảnh báo toàn hệ thống và theo dõi trạng thái máy chủ</p>
        </div>
      </div>

      {(settings.error || overview.error) && (
        <div className="alert-box alert-box-red" role="alert">{settings.error?.message ?? overview.error?.message}</div>
      )}

      <div className="admin-settings-grid">
        <form className="card admin-settings-form" onSubmit={onSubmit}>
          <div className="card-head">
            <div>
              <h2 className="card-title">Chính sách cảnh báo</h2>
              <p className="card-sub">Các thay đổi áp dụng cho vòng đời phát hiện cảnh báo của hệ thống</p>
            </div>
            <Badge tone="blue" dot>{USE_MOCK ? 'Đang dùng mock' : 'Backend'}</Badge>
          </div>
          {settings.loading && !settings.data ? <Skeleton height={230} /> : (
            <>
              <div className="admin-settings-fields">
                {FIELD_INFO.map((field) => (
                  <Field key={field.key} label={field.label} error={fieldErrors[field.key]}>
                    <div className="admin-number-input">
                      <input
                        className="input"
                        type="number"
                        min={field.min}
                        max={field.max}
                        step="1"
                        required
                        value={values[field.key]}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
                      />
                      <span>{field.unit}</span>
                    </div>
                  </Field>
                ))}
              </div>
              {settings.data?.metrics && (
                <div className="admin-global-rules">
                  <div className="admin-settings-section-head">
                    <h3>Ngưỡng cảnh báo toàn hệ thống</h3>
                    <p>Áp dụng khi cảm biến vượt ngưỡng; các kênh nhận và mức độ được lưu cùng cấu hình.</p>
                  </div>
                  <div className="table-wrap">
                    <table className="table admin-rules-table">
                      <thead>
                        <tr><th>Cảm biến</th><th>Ngưỡng dưới</th><th>Ngưỡng trên</th><th>Mức độ</th><th>Kênh nhận</th><th>Gửi thử</th></tr>
                      </thead>
                      <tbody>
                        {settings.data.metrics.map((metric) => {
                          const rule = values.alert_rules?.find((item) => item.metric === metric.metric);
                          if (!rule) return null;
                          return (
                            <tr key={metric.metric}>
                              <td><strong>{metric.label}</strong><span className="admin-log-id">Giới hạn {metric.range.min}–{metric.range.max} {metric.unit}</span></td>
                              <td><input className="input admin-rule-number" aria-label={`${metric.label} ngưỡng dưới`} type="number" min={metric.range.min} max={metric.range.max} step="any" value={rule.min ?? ''} onChange={(event) => updateAlertRule(metric.metric, { min: event.target.value === '' ? null : Number(event.target.value) })} /></td>
                              <td><input className="input admin-rule-number" aria-label={`${metric.label} ngưỡng trên`} type="number" min={metric.range.min} max={metric.range.max} step="any" value={rule.max ?? ''} onChange={(event) => updateAlertRule(metric.metric, { max: event.target.value === '' ? null : Number(event.target.value) })} /></td>
                              <td>
                                <select className="select admin-rule-severity" value={rule.severity} onChange={(event) => updateAlertRule(metric.metric, { severity: event.target.value })}>
                                  <option value="warning">Cảnh báo</option>
                                  <option value="danger">Nguy hiểm</option>
                                </select>
                              </td>
                              <td>
                                <div className="admin-channel-list">
                                  {CHANNELS.map((channel) => (
                                    <label key={channel.id}>
                                      <input
                                        type="checkbox"
                                        checked={rule.channels?.includes(channel.id) ?? false}
                                        onChange={(event) => updateAlertRule(metric.metric, {
                                          channels: event.target.checked
                                            ? [...(rule.channels ?? []), channel.id]
                                            : (rule.channels ?? []).filter((item) => item !== channel.id),
                                        })}
                                      />
                                      {channel.label}
                                    </label>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <button className="btn btn-outline btn-sm" type="button" disabled={!rule.channels?.length || testingChannel.startsWith(`${metric.metric}:`)} onClick={() => testChannel(rule, rule.channels[0])}>
                                  <Icon name="send" size={15} /> {testingChannel.startsWith(`${metric.metric}:`) ? 'Đang thử' : 'Thử kênh'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {fieldErrors.alert_rules && <p className="field-error">{fieldErrors.alert_rules}</p>}
                  {!USE_MOCK && <p className="admin-settings-note">Gửi thử và cấu hình kênh cần API backend triển khai; hiện chỉ chạy trong mock.</p>}
                </div>
              )}
              {error && <div className="alert-box alert-box-red admin-settings-error">{error}</div>}
              <div className="admin-settings-actions">
                <button className="btn btn-primary" type="submit" disabled={saving || settings.loading}>
                  <Icon name="check" size={17} /> {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
                </button>
              </div>
            </>
          )}
        </form>

        <section className="card admin-server-card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Sức khỏe máy chủ</h2>
              <p className="card-sub">Trạng thái dịch vụ và kết nối hiện tại</p>
            </div>
            {overview.data && (
              <Badge tone={overview.data.server.healthy ? 'green' : 'red'} dot>
                {overview.data.server.healthy ? 'Hoạt động' : 'Có sự cố'}
              </Badge>
            )}
          </div>
          {overview.loading && !overview.data ? <Skeleton height={180} /> : overview.data && (
            <dl className="admin-server-list">
              <div><dt>Nguồn dữ liệu</dt><dd>{USE_MOCK ? 'Mock cục bộ' : 'Backend API'}</dd></div>
              <div><dt>Kết nối thời gian thực</dt><dd>{overview.data.server.healthy ? 'Đang hoạt động' : 'Mất kết nối'}</dd></div>
              <div><dt>Độ trễ trung bình</dt><dd>{overview.data.server.avgLatencyMs == null ? 'Chưa có dữ liệu' : `${overview.data.server.avgLatencyMs} ms`}</dd></div>
              <div><dt>Thiết bị offline</dt><dd>{overview.data.devices.offline}</dd></div>
            </dl>
          )}
          {!USE_MOCK && <p className="admin-settings-note">Thông tin cấu hình kết nối được quản lý ở biến môi trường phía server; giao diện không lưu thông tin bí mật.</p>}
        </section>
      </div>
    </div>
  );
}
