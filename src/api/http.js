// Gọi backend Express thật của nhóm (cùng API mà FrontEnd-SmartHome đang dùng).
// Vite chuyển tiếp /api tới VITE_API_TARGET (mặc định http://localhost:5000) – xem vite.config.js.
//
// ĐÃ CÓ ở backend nhóm: /auth, /users, /types, /component-models, /device-models, /places, /devices/...
// CHƯA CÓ (cần nhóm backend bổ sung theo database-design.md): /components, /commands,
//   /threshold-rules, /schedules, /alerts, /admin/overview, /admin/logs, /admin/settings, PATCH /users/me.
// Các trang dùng chúng sẽ báo lỗi cho tới khi backend hỗ trợ.

import { getToken } from './session.js';
import { ApiError } from './errors.js';
import { nextCronRun } from '../utils/format.js';

async function req(method, path, { body, query } = {}) {
  const url = new URL('/api' + path, window.location.origin);
  Object.entries(query ?? {}).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, v));
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ', 'network');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code =
      res.status === 401 ? 'unauthorized'
      : res.status === 403 ? 'forbidden'
      : res.status === 404 ? 'not_found'
      : res.status === 409 ? 'conflict'
      : res.status === 429 ? 'busy' // quá 25 lệnh/phút
      : res.status === 503 ? 'broker' // chưa cấu hình gửi lệnh xuống bo
      : 'error';
    throw new ApiError(data?.error ?? data?.message ?? `Lỗi ${res.status}`, data?.code ?? code, data?.details ?? {});
  }
  return data;
}
const get = (p, q) => req('GET', p, { query: q });
const post = (p, b) => req('POST', p, { body: b ?? {} });
const patch = (p, b) => req('PATCH', p, { body: b });
const del = (p) => req('DELETE', p);

// ---- xác thực
export const login = (username, password) => post('/auth/login', { username, password });
export const register = (body) => post('/auth/register', body);
export const logout = async () => null; // JWT: xóa token phía client là đủ
export const me = () => get('/auth/me');
// Backend chưa có PATCH /users/me → sửa chính mình qua PATCH /users/:id (user được sửa chính mình)
export const updateMe = async (body) => patch(`/users/${(await me())._id}`, body);
export const changePassword = (current_password, new_password) => patch('/users/me/password', { current_password, new_password });

// ---- quản trị tài khoản
export const listUsers = (q) => get('/users', q);
export const createUser = (b) => post('/users', b);
export const updateUser = (id, b) => patch(`/users/${id}`, b);
export const resetUserPassword = (id, new_password) => patch(`/users/${id}/password`, { new_password });
export const deleteUser = (id) => del(`/users/${id}`);
export const adminOverview = () => get('/admin/overview');
export const listAdminLogs = (q) => get('/admin/logs', q);
export const getAdminSettings = () => get('/admin/settings');
export const updateAdminSettings = (settings) => patch('/admin/settings', settings);
export const testAdminAlertChannel = (metric, channel) => post('/admin/settings/test-alert', { metric, channel });

// ---- danh mục
export const listTypes = () => get('/types');
export const listComponentModels = () => get('/component-models');
export const listDeviceModels = () => get('/device-models');
export const exportDeviceModel = (id) => get(`/device-models/${id}/export`);

// ---- vị trí
export const listPlaces = () => get('/places');
export const createPlace = (b) => post('/places', b);
export const updatePlace = (id, b) => patch(`/places/${id}`, b);
export const deletePlace = (id) => del(`/places/${id}`);
export const placeDevices = (id, recursive = true) => get(`/places/${id}/devices`, { recursive });

// ---- thiết bị
export const myDevices = () => get('/devices/mine');
export const listDevices = (q) => get('/devices', q);
export const cloneDevices = (b) => post('/devices', b);
export const getDevice = (id) => get(`/devices/${id}`);
export const registerDevice = (b) => post('/devices/register', b);
export const updateDevice = (id, b) => patch(`/devices/${id}`, b);
export const unregisterDevice = (id) => post(`/devices/${id}/unregister`);
export const deviceStatus = (id) => get(`/devices/${id}/status`);
export const deviceLatest = (id) => get(`/devices/${id}/latest`);
export const deviceData = (id, q) => deviceDataLatestFirst(id, q);
export const deviceControl = (id, q) => get(`/devices/${id}/control`, q);
export const deviceCommands = (id, q) => get(`/devices/${id}/commands`, q);
export const sendDeviceCommand = (id, b) => post(`/devices/${id}/commands`, b);

// ---- ghép dữ liệu theo dạng web dùng
// Backend lưu theo thiết bị (device + component_model), web dùng "component" có id riêng.
// Id component ở chế độ backend thật = `${device_id}:${component_model_id}`.
export const componentKey = (deviceId, componentModelId) => `${deviceId}:${componentModelId}`;
export function splitComponentKey(id) {
  const [deviceId, componentModelId] = String(id ?? '').split(':');
  if (!deviceId || !componentModelId) throw new ApiError('Thiết bị không hợp lệ', 'validation', { fields: { component_id: 'Chọn thiết bị' } });
  return { deviceId, componentModelId };
}

export async function listComponents() {
  const devices = await myDevices();
  const lists = await Promise.all(
    devices.map((d) =>
      deviceLatest(d._id).then((r) =>
        r.components.map((c) => ({
          ...c,
          _id: componentKey(d._id, c.componentModel._id),
          device_id: d._id,
          device_name: d.device_name,
          device_mode: d.mode,
          device_online: d.online,
          place_id: d.place_id,
        })),
      ),
    ),
  );
  return lists.flat();
}

// Lịch sử số đo: lấy các điểm mới nhất trong khoảng rồi đảo lại cho đúng thứ tự thời gian
export async function deviceDataLatestFirst(id, q) {
  const r = await get(`/devices/${id}/data`, { ...q, order: 'desc' });
  return { ...r, items: [...r.items].reverse(), aggregated: false };
}

// Tên quy tắc / lịch hẹn đã phát lệnh (commands.rule_id)
async function refNames(deviceIds) {
  const names = new Map();
  await Promise.all(
    deviceIds.map(async (id) => {
      const [rules, schedules] = await Promise.all([
        get(`/devices/${id}/rules`).catch(() => []),
        get(`/devices/${id}/schedules`).catch(() => []),
      ]);
      [...rules, ...schedules].forEach((x) => names.set(x._id, x.name));
    }),
  );
  return names;
}

// Lệnh của backend → dạng web: component_id, status ('sent' = đã gửi tới Adafruit, bo chưa xác nhận), ref_name
const toCommand = (c, deviceId, names) => ({
  ...c,
  device_id: c.device_id ?? deviceId,
  component_id: componentKey(c.device_id ?? deviceId, c.component_model_id),
  status: c.status ?? 'sent',
  ref_name: c.rule_id ? names.get(c.rule_id) ?? null : null,
});

// ---- lịch sử điều khiển: ghép nhật ký lệnh của từng thiết bị (GET /devices/:id/commands)
export async function listCommands(q = {}) {
  const ids = q.device_id ? [q.device_id] : (await myDevices()).map((d) => d._id);
  const [lists, names] = await Promise.all([
    Promise.all(ids.map((id) => deviceCommands(id, { limit: 200 }).then((r) => r.items.map((c) => [c, id])))),
    refNames(ids),
  ]);
  const f = q.from ? new Date(q.from).getTime() : -Infinity;
  const t = q.to ? new Date(q.to).getTime() : Infinity;
  const all = lists
    .flat()
    .map(([c, id]) => toCommand(c, id, names))
    .filter((c) => (!q.source || c.source === q.source) && (!q.status || c.status === q.status))
    .filter((c) => new Date(c.sent_at).getTime() >= f && new Date(c.sent_at).getTime() <= t)
    .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
  const page = Number(q.page) || 1;
  const limit = Number(q.limit) || 12;
  return { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit };
}

// ---- threshold_rules / schedules / alerts (theo database-design.md, backend cần bổ sung)
// Backend chưa có → báo rõ thay vì "Lỗi 404"
const NOT_YET = 'Backend hiện chưa có chức năng này (threshold_rules / schedules / alerts – xem HUONG-DAN-TRIEN-KHAI.md mục 7.9). Chạy chế độ giả lập để xem thử.';
const soon = (p) =>
  p.catch((e) => {
    throw e.code === 'not_found' ? new ApiError(NOT_YET, 'unsupported') : e;
  });

export const listRules = () => soon(get('/threshold-rules'));
export const saveRule = (r) => (r._id ? patch(`/threshold-rules/${r._id}`, r) : post('/threshold-rules', r)).then((x) => (x?.rule ? x : { rule: x, warning: null }));
export const deleteRule = (id) => del(`/threshold-rules/${id}`);

// ---- hẹn giờ: backend lưu theo thiết bị (/devices/:id/schedules, time "HH:mm" + days[]),
// web dùng cron "m h * * d" và component_id → chuyển đổi hai chiều ở đây.
const scheduleDevice = new Map(); // schedule _id → device_id

function cronToTime(cron) {
  const [m, h, , , d] = String(cron ?? '').trim().split(/\s+/);
  const mm = Number(m);
  const hh = Number(h);
  if (!Number.isInteger(mm) || !Number.isInteger(hh) || mm < 0 || mm > 59 || hh < 0 || hh > 23)
    throw new ApiError('Giờ hoặc ngày lặp không hợp lệ', 'validation', { fields: { cron: 'Giờ hoặc ngày lặp không hợp lệ' } });
  const days = !d || d === '*' ? [] : d.split(',').map(Number);
  return { time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, days };
}

function toSchedule(s) {
  const [hh, mm] = s.time.split(':').map(Number);
  const cron = `${mm} ${hh} * * ${s.days?.length ? [...s.days].sort().join(',') : '*'}`;
  scheduleDevice.set(s._id, s.device_id);
  return {
    ...s,
    component_id: componentKey(s.device_id, s.action.component_model_id),
    action: s.action.mode === 'on' ? { mode: 'on', value: s.action.val } : { mode: 'off' },
    cron,
    timezone: 'Asia/Ho_Chi_Minh',
    next_run_at: s.enabled ? nextCronRun(cron) : null,
  };
}

export async function listSchedules() {
  const devices = await myDevices();
  const lists = await Promise.all(devices.map((d) => get(`/devices/${d._id}/schedules`)));
  return lists.flat().map(toSchedule);
}

export async function saveSchedule(input) {
  const { deviceId, componentModelId } = splitComponentKey(input.component_id);
  const { time, days } = cronToTime(input.cron);
  const v = input.action?.value;
  const body = {
    name: input.name,
    enabled: input.enabled !== false,
    time,
    days,
    action: {
      component_model_id: componentModelId,
      mode: input.action?.mode === 'on' ? 'on' : 'off',
      // backend nhận số; đèn công tắc bật không cần mức
      ...(input.action?.mode === 'on' && typeof v === 'number' ? { val: v } : {}),
    },
  };
  const oldDevice = input._id ? scheduleDevice.get(input._id) : null;
  if (input._id && oldDevice === deviceId) return toSchedule(await patch(`/devices/${deviceId}/schedules/${input._id}`, body));
  const created = toSchedule(await post(`/devices/${deviceId}/schedules`, body));
  // Đổi sang linh kiện của thiết bị khác: tạo lịch mới rồi xóa lịch cũ
  if (input._id && oldDevice) await del(`/devices/${oldDevice}/schedules/${input._id}`);
  return created;
}

const deviceOfSchedule = (id) => {
  const d = scheduleDevice.get(id);
  if (!d) throw new ApiError('Không tìm thấy lịch hẹn, tải lại trang rồi thử lại', 'not_found');
  return d;
};
export const setScheduleEnabled = async (id, enabled) => toSchedule(await patch(`/devices/${deviceOfSchedule(id)}/schedules/${id}`, { enabled }));
export const deleteSchedule = (id) => del(`/devices/${deviceOfSchedule(id)}/schedules/${id}`);

export const listAlerts = (q) => soon(get('/alerts', q));
export const alertSummary = () => get('/alerts/summary');
export const getAlert = (id) => get(`/alerts/${id}`);
export const acknowledgeAlert = (id) => post(`/alerts/${id}/ack`);

// ---- thời gian thực: backend hiện chưa có WebSocket → các trang tự làm mới định kỳ
export const subscribe = () => () => {};
export const isSocketConnected = () => true;
export const simulator = null;
