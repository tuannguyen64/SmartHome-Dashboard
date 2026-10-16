// Gọi backend Express thật của nhóm (cùng API mà FrontEnd-SmartHome đang dùng).
// Vite chuyển tiếp /api tới VITE_API_TARGET (mặc định http://localhost:5000) – xem vite.config.js.
//
// ĐÃ CÓ ở backend nhóm: /auth, /users, /types, /component-models, /device-models, /places, /devices/...
// CHƯA CÓ (cần nhóm backend bổ sung theo database-design.md): /components, /commands,
//   /threshold-rules, /schedules, /alerts, PATCH /users/me. Các trang dùng chúng sẽ báo lỗi cho tới khi có.

import { getToken } from './session.js';
import { ApiError } from './errors.js';

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
export const updateMe = (body) => patch('/users/me', body);
export const changePassword = (current_password, new_password) => patch('/users/me/password', { current_password, new_password });

// ---- quản trị tài khoản
export const listUsers = (q) => get('/users', q);
export const createUser = (b) => post('/users', b);
export const updateUser = (id, b) => patch(`/users/${id}`, b);
export const resetUserPassword = (id, new_password) => patch(`/users/${id}/password`, { new_password });
export const deleteUser = (id) => del(`/users/${id}`);

// ---- danh mục
export const listTypes = () => get('/types');
export const listComponentModels = () => get('/component-models');
export const listDeviceModels = () => get('/device-models');

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
export const deviceData = (id, q) => get(`/devices/${id}/data`, { order: 'asc', ...q });
export const deviceControl = (id, q) => get(`/devices/${id}/control`, q);
export const deviceCommands = (id, q) => get(`/devices/${id}/commands`, q);
export const sendDeviceCommand = (id, b) => post(`/devices/${id}/commands`, b);

// Backend chưa có /components → ghép từ /devices/mine + /devices/:id/latest
export async function listComponents() {
  try {
    return await get('/components');
  } catch (e) {
    if (e.code !== 'not_found') throw e;
  }
  const devices = await myDevices();
  const lists = await Promise.all(
    devices.map((d) =>
      deviceLatest(d._id).then((r) =>
        r.components.map((c) => ({
          ...c,
          _id: c.component_id ?? `${d._id}:${c.componentModel._id}`,
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

// ---- lịch sử điều khiển
// Backend chưa có /commands → ghép nhật ký lệnh của từng thiết bị (GET /devices/:id/commands)
export async function listCommands(q = {}) {
  try {
    return await get('/commands', q);
  } catch (e) {
    if (e.code !== 'not_found') throw e;
  }
  const ids = q.device_id ? [q.device_id] : (await myDevices()).map((d) => d._id);
  const lists = await Promise.all(ids.map((id) => deviceCommands(id, { limit: 100 }).then((r) => r.items.map((c) => ({ ...c, device_id: c.device_id ?? id })))));
  const f = q.from ? new Date(q.from).getTime() : -Infinity;
  const t = q.to ? new Date(q.to).getTime() : Infinity;
  const all = lists
    .flat()
    .map((c) => ({ ...c, source: c.source ?? 'dashboard', status: c.status ?? null }))
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

export const listSchedules = () => soon(get('/schedules'));
export const saveSchedule = (s) => (s._id ? patch(`/schedules/${s._id}`, s) : post('/schedules', s));
export const setScheduleEnabled = (id, enabled) => patch(`/schedules/${id}`, { enabled });
export const deleteSchedule = (id) => del(`/schedules/${id}`);

export const listAlerts = (q) => soon(get('/alerts', q));
export const alertSummary = () => get('/alerts/summary');
export const getAlert = (id) => get(`/alerts/${id}`);
export const acknowledgeAlert = (id) => post(`/alerts/${id}/ack`);

// ---- thời gian thực: backend hiện chưa có WebSocket → các trang tự làm mới định kỳ
export const subscribe = () => () => {};
export const isSocketConnected = () => true;
export const simulator = null;
