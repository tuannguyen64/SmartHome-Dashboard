import { fmtThreshold } from './format.js';

const rulesFor = (comp, rules) => (rules ?? []).filter((r) => r.enabled && r.component_id === comp._id);

// Tô màu giá trị theo threshold_rules đang bật của component: bình thường / cảnh báo / nguy hiểm
export function sensorStatus(comp, rules) {
  const v = comp.data?.value;
  if (v == null) return { key: 'nodata', label: 'Chưa có dữ liệu', tone: 'gray' };
  if (comp.device_online === false) return { key: 'offline', label: 'offline', tone: 'gray' };
  let level = null;
  rulesFor(comp, rules).forEach((r) => {
    if (!((r.min != null && v < r.min) || (r.max != null && v > r.max))) return;
    level = r.severity === 'danger' || level === 'danger' ? 'danger' : 'warning';
  });
  if (level === 'danger') return { key: 'danger', label: 'Nguy hiểm', tone: 'red' };
  if (level === 'warning') return { key: 'warning', label: 'Cảnh báo', tone: 'amber' };
  return { key: 'normal', label: 'Bình thường', tone: 'green' };
}

export function thresholdText(comp, rules) {
  const rank = (r) => (r.severity === 'warning' ? 0 : 1);
  const rs = rulesFor(comp, rules).sort((a, b) => rank(a) - rank(b));
  if (!rs.length) return 'Chưa đặt ngưỡng';
  return `Ngưỡng: ${fmtThreshold(rs[0].min, rs[0].max, comp.componentModel.unit)}`;
}

export const alertTone = (a) => (a.status === 'resolved' ? 'green' : a.severity === 'danger' ? 'red' : 'amber');
