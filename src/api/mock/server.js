// Backend giả lập chạy ngay trong trình duyệt, theo mô hình dữ liệu MongoDB của nhóm (database-design.md)
// và cùng các API mà backend Express của nhóm cung cấp (xem http.js).
// Mô phỏng: bo Yolo:Bit gửi số đo, lệnh chờ xác nhận, threshold_rules (+ auto_action), schedules (cron),
// alerts, phát hiện mất kết nối. Đặt VITE_USE_MOCK=false để dùng backend thật.

import { createSeed, SEED_VERSION, fakeHash, oid, regCode, RGB_DEFAULT } from './seed.js';
import { syntheticValue, inOutage } from './synthetic.js';
import { PARAMS, metricInfo, isStaff } from '../../utils/constants.js';
import { nextCronRun, placePaths } from '../../utils/format.js';
import { getToken } from '../session.js';
import { ApiError } from '../errors.js';

const STORAGE_KEY = 'smarthome-mongo-mock';
const TICK_MS = 5000; // bản demo: bo gửi mỗi 5 giây cho dễ quan sát (thật: 30 giây)
const LIVE_KEEP = 2000;
const BUDGET_PER_MIN = 25 - 6; // 25 điểm/phút trừ phần cảm biến (NFR3)

// ================================================================ lưu trữ

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.version === SEED_VERSION) return d;
    }
  } catch {
    /* tạo mới */
  }
  return createSeed();
}

let db = load();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* chạy trong bộ nhớ */
    }
  }, 300);
}

// Mở lại trang: coi như bo vẫn chạy, bỏ lệnh treo
(function boot() {
  const t = new Date().toISOString();
  db.devices.forEach((d) => d.owner_id && d.last_seen && (d.last_seen = t));
  db.components.forEach((c) => (c.sync.pending_command_id = null));
  db.commands.forEach((c) => {
    if (c.status === 'pending') {
      c.status = 'failed';
      c.reason = 'Lệnh hết hiệu lực';
    }
  });
})();

// ================================================================ mô phỏng + sự kiện

const sim = { socket: true, broker: true, board: true, noAck: false, overrides: {} };
const listeners = new Set();
function emit(type, payload) {
  if (!sim.socket) return;
  const data = structuredClone(payload);
  listeners.forEach((fn) => fn({ type, payload: data }));
}
const emitConnection = () => listeners.forEach((fn) => fn({ type: 'connection', payload: { connected: sim.socket } }));

const now = () => Date.now();
const iso = (t = now()) => new Date(t).toISOString();
const clone = (x) => structuredClone(x);
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms + Math.random() * 100));

let started = false;
async function respond(fn, ms) {
  start();
  await delay(ms);
  const r = fn();
  save();
  return r === undefined ? undefined : clone(r);
}

// ================================================================ truy vấn nội bộ

const byId = (list, id) => list.find((x) => x._id === id);
const must = (x, what) => {
  if (!x) throw new ApiError(`Không tìm thấy ${what}`, 'not_found');
  return x;
};
const cmOf = (c) => byId(db.component_models, c.component_model_id);
const deviceOf = (c) => byId(db.devices, c.device_id);
const compsOf = (d) => db.components.filter((c) => c.device_id === d._id);
const isOnline = (d) => !!d.last_seen && now() - new Date(d.last_seen).getTime() < PARAMS.OFFLINE_AFTER_S * 1000;
const placeName = (id) => byId(db.places, id)?.name ?? '';
const pub = ({ password, failed_attempts, locked_until, ...u }) => u;

function requireUser() {
  const u = byId(db.users, db.tokens[getToken()]);
  if (!u || !u.is_active) throw new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'unauthorized');
  return u;
}
const requireRole = (u, roles) => {
  if (!roles.includes(u.role)) throw new ApiError('Bạn không có quyền thực hiện thao tác này', 'forbidden');
};
const canSee = (u, d) => isStaff(u) || d.owner_id === u._id || d.shared_with.includes(u._id);
const canSeeComp = (u, cid) => {
  const c = byId(db.components, cid);
  const d = c && deviceOf(c);
  return !!d && canSee(u, d);
};
const withOnline = (d) => ({ ...d, online: isOnline(d) });
const page = (list, { page: p = 1, limit = 10 } = {}) => {
  const pg = Math.max(1, Number(p) || 1);
  const l = Math.max(1, Number(limit) || 10);
  return { items: list.slice((pg - 1) * l, pg * l), total: list.length, page: pg, limit: l };
};

// Một phần tử của /devices/:id/latest
function latestEntry(c) {
  const cm = cmOf(c);
  const last = c.control[c.control.length - 1] ?? null;
  return {
    component_id: c._id,
    componentModel: cm,
    data: c.value_at != null ? { value: c.value, ts: c.value_at } : null,
    control: cm.kind === 'actuator' ? last : null,
    mode: c.mode,
    pending: !!c.sync.pending_command_id,
    lastUpdate: [c.value_at, last?.ts].filter(Boolean).sort().pop() ?? null,
  };
}

// Phần tử của /components (collection components + thông tin thiết bị để hiển thị)
function componentView(c) {
  const d = deviceOf(c);
  return {
    ...latestEntry(c),
    _id: c._id,
    device_id: d._id,
    device_name: d.device_name,
    device_mode: d.mode,
    device_online: isOnline(d),
    place_id: d.place_id,
  };
}

// ================================================================ ngân sách gửi (NFR3)

const sentLog = [];
const budgetLeft = () => {
  const t = now() - 60000;
  while (sentLog.length && sentLog[0] < t) sentLog.shift();
  return BUDGET_PER_MIN - sentLog.length;
};
const consume = (n) => {
  for (let i = 0; i < n; i++) sentLog.push(now());
};

// ================================================================ commands (SF02)

function pushCommand(cmd) {
  db.commands.unshift(cmd);
  if (db.commands.length > 3000) db.commands.length = 3000;
  emit('command', cmd);
  return cmd;
}

const newCommand = (c, payload, source, extra = {}) => ({
  _id: oid(),
  component_id: c._id,
  component_model_id: c.component_model_id,
  device_id: c.device_id,
  source,
  ref_id: null,
  ref_name: null,
  payload,
  status: 'pending',
  reason: null,
  issued_by: null,
  sent_at: iso(),
  latency_ms: null,
  ...extra,
});

function logSkipped(c, payload, source, reason, extra) {
  pushCommand({ ...newCommand(c, payload, source, extra), status: 'skipped', reason });
}

function applyState(c, payload, source = 'command') {
  const cm = cmOf(c);
  c.mode = payload.mode;
  if (cm.metric === 'rgb_color') {
    if (payload.val && typeof payload.val === 'object') c.value = payload.val;
  } else c.value = payload.mode === 'on' ? payload.val : 0;
  if (payload.mode === 'on' && payload.val != null) c.last_on_value = payload.val;
  c.value_at = iso();
  c.control.push({ ts: iso(), mode: payload.mode, val: payload.mode === 'on' ? payload.val : 0, source });
  if (c.control.length > 500) c.control.splice(0, c.control.length - 500);
}

function sendCommand(c, payload, source, extra = {}, attempt = 1) {
  const cmd = pushCommand(newCommand(c, payload, source, extra));
  consume(2);
  c.sync.pending_command_id = cmd._id;
  emit('component', componentView(c));
  const t0 = now();

  setTimeout(() => {
    const comp = byId(db.components, c._id);
    const d = comp && deviceOf(comp);
    const k = byId(db.commands, cmd._id);
    if (!comp || !k || k.status !== 'pending' || sim.noAck || !sim.broker || !isOnline(d)) return;
    applyState(comp, payload);
    comp.sync.pending_command_id = null;
    comp.sync.last_ack_at = iso();
    k.status = 'success';
    k.latency_ms = Math.round(now() - t0);
    emit('component', componentView(comp));
    emit('command', k);
    save();
  }, 450 + Math.random() * 900);

  setTimeout(() => {
    const comp = byId(db.components, c._id);
    const k = byId(db.commands, cmd._id);
    if (!k || k.status !== 'pending') return;
    k.status = 'failed';
    k.reason = 'Thiết bị không phản hồi trong 5 giây';
    if (comp && comp.sync.pending_command_id === k._id) comp.sync.pending_command_id = null;
    if (comp) emit('component', componentView(comp));
    emit('command', k);
    // SF03 A5 / SF04 A3: thử lại 3 lần rồi mới cảnh báo
    if (comp && source !== 'dashboard') {
      if (attempt <= 3 && isOnline(deviceOf(comp))) sendCommand(comp, payload, source, extra, attempt + 1);
      else raiseControlFailed(comp, extra.ref_name ?? source);
    }
    save();
  }, PARAMS.COMMAND_ACK_TIMEOUT_MS);
  return cmd;
}

const sameState = (c, payload) => {
  if (payload.mode !== c.mode) return false;
  if (payload.mode === 'off') return true;
  return JSON.stringify(payload.val) === JSON.stringify(c.value);
};

// Thực thi hành động tự động (quy tắc / lịch) với các quy tắc ưu tiên của đặc tả
function autoControl(c, action, source, extra, { resolving = false } = {}) {
  const d = deviceOf(c);
  const cm = cmOf(c);
  const payload = { mode: action.mode, val: action.mode === 'on' ? action.value ?? c.last_on_value ?? cm.range?.max ?? 100 : 0 };
  if (d.mode !== 'custom') return logSkipped(c, payload, source, `Thiết bị ở chế độ ${d.mode === 'on' ? 'Ép bật' : 'Ép tắt'}`, extra);
  if (c.last_manual_at && now() - new Date(c.last_manual_at).getTime() < PARAMS.MANUAL_PRIORITY_MS)
    return logSkipped(c, payload, source, 'Ưu tiên thao tác tay (15 phút)', extra);
  if (source === 'automation' && !resolving && c.held_by?.startsWith('schedule:'))
    return logSkipped(c, payload, source, 'Lịch hẹn đang giữ thiết bị', extra);
  if (resolving && c.held_by !== `rule:${extra.ref_id}`) return logSkipped(c, payload, source, 'Thiết bị không do quy tắc này bật', extra);
  if (sameState(c, payload)) return;
  if (!isOnline(d) || !sim.broker) {
    logSkipped(c, payload, source, 'Thiết bị offline', extra);
    return raiseControlFailed(c, extra.ref_name ?? source);
  }
  if (budgetLeft() < 2) return logSkipped(c, payload, source, 'Hết ngân sách gửi trong phút này', extra);
  c.held_by = payload.mode === 'on' ? `${source === 'schedule' ? 'schedule' : 'rule'}:${extra.ref_id}` : null;
  sendCommand(c, payload, source, extra);
}

// ================================================================ alerts (SF05/SF06)

function deliver(channels, { cooldown = false } = {}) {
  const list = [];
  if (channels.includes('dashboard')) list.push({ channel: 'dashboard', status: 'sent', attempts: 1, sent_at: iso() });
  if (channels.includes('telegram')) {
    const n = db.users.filter((u) => u.telegram_chat_id).length;
    list.push(
      cooldown
        ? { channel: 'telegram', status: 'skipped', attempts: 0, last_error: 'Trong thời gian chờ 10 phút' }
        : n
          ? { channel: 'telegram', status: 'sent', attempts: 1, sent_at: iso() }
          : { channel: 'telegram', status: 'failed', attempts: 0, last_error: 'Chưa có người dùng liên kết Telegram' },
    );
  }
  if (channels.includes('lcd')) {
    // Kênh tại chỗ: đèn LED RGB (model "led") sáng đỏ
    const lamp = db.components.find((c) => cmOf(c).name === 'led' && deviceOf(c).owner_id);
    if (!lamp || !isOnline(deviceOf(lamp)) || !sim.broker) list.push({ channel: 'lcd', status: 'failed', attempts: 1, last_error: 'Bo Yolo:Bit offline' });
    else {
      consume(1);
      list.push({ channel: 'lcd', status: 'sent', attempts: 1, sent_at: iso() });
    }
  }
  return list;
}

function newAlert(fields) {
  const a = {
    _id: oid(), type: 'threshold', rule_id: null, place_id: null, component_id: null, device_ids: [], metric: null,
    value: null, worst_value: null, threshold: null, severity: 'warning', status: 'active', message: '', deliveries: [],
    triggered_at: iso(), resolved_at: null, resolve_reason: null, acknowledged_by: null, acknowledged_at: null, reminded_at: null, seen: false,
    ...fields,
  };
  db.alerts.unshift(a);
  if (db.alerts.length > 1000) db.alerts.length = 1000;
  emit('alert', a);
  emit('notice', { tone: a.severity === 'danger' ? 'red' : 'amber', title: 'Cảnh báo mới', text: a.message, alertId: a._id });
  return a;
}

function resolveAlert(a, reason, notify = true) {
  if (!a || a.status === 'resolved') return;
  a.status = 'resolved';
  a.resolved_at = iso();
  a.resolve_reason = reason;
  emit('alert', a);
  if (notify) emit('notice', { tone: 'green', title: 'Đã trở lại bình thường', text: a.message });
}

function raiseControlFailed(c, by) {
  const d = deviceOf(c);
  newAlert({
    type: 'control_failed', place_id: d.place_id, component_id: c._id, device_ids: [d._id],
    message: `Không điều khiển được ${cmOf(c).label} của ${d.device_name} (${by}) sau 3 lần thử`,
    deliveries: deliver(['dashboard', 'telegram']),
  });
}

function evaluateRules(c, v) {
  const cm = cmOf(c);
  const h = metricInfo(cm.metric).hysteresis ?? 1;
  db.threshold_rules
    .filter((r) => r.enabled && r.component_id === c._id)
    .forEach((rule) => {
      const st = (db.rule_states[rule._id] ||= { count: 0, alert_id: null, last_resolved_at: null, auto_active: false });
      const open = st.alert_id ? db.alerts.find((a) => a._id === st.alert_id && a.status !== 'resolved') : null;
      if (st.alert_id && !open) st.alert_id = null;
      const breached = rule.min != null && v < rule.min ? 'min' : rule.max != null && v > rule.max ? 'max' : null;
      const d = deviceOf(c);

      if (breached) {
        st.count += 1;
        if (open) {
          open.value = v;
          open.worst_value = breached === 'max' ? Math.max(open.worst_value, v) : Math.min(open.worst_value, v);
          emit('alert', open);
        } else if (st.count >= PARAMS.BREACH_COUNT) {
          const cooldown = st.last_resolved_at && now() - new Date(st.last_resolved_at).getTime() < PARAMS.ALERT_COOLDOWN_MS;
          const limit = breached === 'max' ? rule.max : rule.min;
          const a = newAlert({
            rule_id: rule._id, place_id: d.place_id, component_id: c._id, device_ids: [d._id], metric: cm.metric,
            value: v, worst_value: v, threshold: { min: rule.min, max: rule.max, breached }, severity: rule.severity,
            message: `${placeName(d.place_id) || d.device_name}: ${cm.label.toLowerCase()} ${v} ${cm.unit} ${breached === 'max' ? 'vượt ngưỡng trên' : 'dưới ngưỡng dưới'} ${limit} ${cm.unit}`,
            deliveries: deliver(rule.channels, { cooldown }),
          });
          st.alert_id = a._id;
        }
        // auto_action: khi điều kiện chuyển từ sai sang đúng
        if (rule.auto_action?.enabled && !st.auto_active && st.count >= 1) {
          const target = byId(db.components, rule.auto_action.component_id);
          if (target) {
            st.auto_active = true;
            autoControl(target, rule.auto_action.on_breach, 'automation', { ref_id: rule._id, ref_name: rule.name });
          }
        }
      } else {
        st.count = 0;
        const safe = (b) => (b === 'max' ? rule.max == null || v <= rule.max - h : rule.min == null || v >= rule.min + h);
        if (open && safe(open.threshold.breached)) {
          resolveAlert(open, 'Giá trị đã trở lại an toàn');
          st.alert_id = null;
          st.last_resolved_at = iso();
        }
        if (st.auto_active && safe('max') && safe('min')) {
          st.auto_active = false;
          const target = byId(db.components, rule.auto_action?.component_id);
          if (target && rule.auto_action?.on_resolve) {
            autoControl(target, rule.auto_action.on_resolve, 'automation', { ref_id: rule._id, ref_name: rule.name }, { resolving: true });
          }
        }
      }
    });
}

// ================================================================ vòng lặp: số đo, mất kết nối, lịch

function deviceOffset(d) {
  let h = 0;
  for (const ch of d._id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return ((h % 20) - 10) / 10; // -1 .. +1
}

function ingest(c, v) {
  const cm = cmOf(c);
  const valid = typeof v === 'number' && Number.isFinite(v) && (!cm.range || (v >= cm.range.min && v <= cm.range.max));
  const live = (db.live[c._id] ||= []);
  live.push({ t: now(), v, valid });
  if (live.length > LIVE_KEEP) live.splice(0, live.length - LIVE_KEEP);
  if (!valid) return; // lưu bản đo invalid nhưng không phát sự kiện (UC01-1 A2)
  c.value = v;
  c.value_at = iso();
  emit('component', componentView(c));
  evaluateRules(c, v);
}

function readingsTick() {
  if (!sim.board || !sim.broker) return;
  const t = now();
  db.devices
    .filter((d) => d.owner_id)
    .forEach((d) => {
      const wasOffline = !isOnline(d);
      d.last_seen = iso(t);
      if (wasOffline) {
        if (d.offline_alert_id) {
          resolveAlert(byId(db.alerts, d.offline_alert_id), 'Thiết bị gửi dữ liệu trở lại');
          d.offline_alert_id = null;
        }
        emit('device', withOnline(d));
      }
      compsOf(d)
        .filter((c) => cmOf(c).kind === 'sensor')
        .forEach((c) => {
          const o = sim.overrides[c._id];
          const base = syntheticValue(cmOf(c).metric, t);
          ingest(c, o !== undefined ? o : Math.round((base + deviceOffset(d)) * 10) / 10);
        });
    });
}

function offlineTick() {
  if (!sim.broker) return; // máy chủ mất Adafruit IO thì không kết luận thiết bị offline
  db.devices
    .filter((d) => d.owner_id && d.last_seen && !isOnline(d) && !d.offline_alert_id)
    .forEach((d) => {
      const a = newAlert({
        type: 'device_offline', place_id: d.place_id, device_ids: [d._id], severity: 'warning',
        message: `${d.device_name} mất kết nối`,
        deliveries: deliver(['dashboard', 'telegram']),
      });
      d.offline_alert_id = a._id;
      emit('device', withOnline(d));
    });
  // Nhắc lại cảnh báo chưa xác nhận sau 15 phút
  db.alerts.forEach((a) => {
    if (a.status === 'active' && !a.reminded_at && now() - new Date(a.triggered_at).getTime() > PARAMS.REMIND_AFTER_MS) {
      a.reminded_at = iso();
      a.deliveries.push({ channel: 'dashboard', status: 'sent', attempts: 1, sent_at: iso(), note: 'Nhắc lại' });
      emit('alert', a);
    }
  });
}

function scheduleTick() {
  const t = now();
  db.schedules.forEach((s) => {
    if (!s.enabled || !s.next_run_at || new Date(s.next_run_at).getTime() > t) return;
    const c = byId(db.components, s.component_id);
    if (c) {
      const extra = { ref_id: s._id, ref_name: s.name };
      if (t - new Date(s.next_run_at).getTime() > 5 * 60000) {
        logSkipped(c, { mode: s.action.mode, val: s.action.value ?? 0 }, 'schedule', 'Bỏ lỡ: hệ thống ngừng chạy qua giờ hẹn', extra);
      } else autoControl(c, s.action, 'schedule', extra);
    }
    s.last_run_at = iso(t);
    s.next_run_at = nextCronRun(s.cron, t + 1000);
    emit('schedule', s);
  });
}

function start() {
  if (started) return;
  started = true;
  if (globalThis.__smarthomeTimers) globalThis.__smarthomeTimers.forEach(clearInterval);
  globalThis.__smarthomeTimers = [
    setInterval(() => {
      readingsTick();
      offlineTick();
      scheduleTick();
      save();
    }, TICK_MS),
  ];
  db.schedules.forEach((s) => s.enabled && !s.next_run_at && (s.next_run_at = nextCronRun(s.cron)));
}

// ================================================================ API: xác thực

export function login(username, password) {
  return respond(() => {
    const u = db.users.find((x) => x.username === String(username).trim());
    if (u?.locked_until && new Date(u.locked_until).getTime() > now()) {
      const mins = Math.ceil((new Date(u.locked_until).getTime() - now()) / 60000);
      throw new ApiError(`Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${mins} phút.`, 'locked');
    }
    if (!u || u.password !== fakeHash(password)) {
      if (u) {
        u.failed_attempts = (u.failed_attempts || 0) + 1;
        if (u.failed_attempts >= PARAMS.LOGIN_MAX_FAILS) {
          u.failed_attempts = 0;
          u.locked_until = iso(now() + PARAMS.LOGIN_LOCK_MS);
          save();
          throw new ApiError('Sai 5 lần liên tiếp. Tài khoản bị khóa đăng nhập trong 15 phút.', 'locked');
        }
        save();
      }
      throw new ApiError('Sai tên đăng nhập hoặc mật khẩu', 'invalid_credentials');
    }
    if (!u.is_active) throw new ApiError('Tài khoản đã bị vô hiệu hóa', 'forbidden');
    u.failed_attempts = 0;
    u.locked_until = null;
    const token = oid() + oid();
    db.tokens[token] = u._id;
    return { accessToken: token, user: pub(u) };
  }, 350);
}

export function register({ username, password, full_name, telegram_chat_id }) {
  return respond(() => {
    const fields = {};
    if (!/^[a-z0-9_.]{3,}$/i.test(username ?? '')) fields.username = 'Tối thiểu 3 ký tự: chữ, số, _ hoặc .';
    if ((password ?? '').length < 6) fields.password = 'Tối thiểu 6 ký tự';
    if (!String(full_name ?? '').trim()) fields.full_name = 'Nhập họ tên';
    if (Object.keys(fields).length) throw new ApiError('Thông tin chưa hợp lệ', 'validation', { fields });
    if (db.users.some((u) => u.username === username)) throw new ApiError('Tên đăng nhập đã tồn tại', 'conflict', { fields: { username: 'Đã tồn tại' } });
    const u = {
      _id: oid(), username, password: fakeHash(password), full_name: full_name.trim(), role: 'user',
      telegram_chat_id: telegram_chat_id || null, is_active: true, failed_attempts: 0, locked_until: null, created_at: iso(),
    };
    db.users.push(u);
    const token = oid() + oid();
    db.tokens[token] = u._id;
    return { accessToken: token, user: pub(u) };
  }, 350);
}

export function logout() {
  return respond(() => {
    delete db.tokens[getToken()];
  });
}

export const me = () => respond(() => pub(requireUser()), 50);

export function updateMe({ full_name, telegram_chat_id }) {
  return respond(() => {
    const u = requireUser();
    if (full_name !== undefined) {
      if (!String(full_name).trim()) throw new ApiError('Họ tên không được để trống', 'validation', { fields: { full_name: 'Bắt buộc' } });
      u.full_name = full_name.trim();
    }
    if (telegram_chat_id !== undefined) u.telegram_chat_id = telegram_chat_id || null;
    return pub(u);
  });
}

export function changePassword(current_password, new_password) {
  return respond(() => {
    const u = requireUser();
    if (u.password !== fakeHash(current_password)) throw new ApiError('Mật khẩu hiện tại không đúng', 'validation', { fields: { current_password: 'Không đúng' } });
    if ((new_password ?? '').length < 6) throw new ApiError('Mật khẩu mới tối thiểu 6 ký tự', 'validation', { fields: { new_password: 'Tối thiểu 6 ký tự' } });
    u.password = fakeHash(new_password);
    return { ok: true };
  }, 300);
}

// ================================================================ API: quản trị tài khoản (admin)

export function listUsers({ search = '', role = '', page: p = 1, limit = 10 } = {}) {
  return respond(() => {
    requireRole(requireUser(), ['admin']);
    const s = search.toLowerCase();
    const list = db.users.filter((u) => (!role || u.role === role) && (!s || u.username.toLowerCase().includes(s) || u.full_name.toLowerCase().includes(s)));
    return page(list.map(pub), { page: p, limit });
  });
}

export function createUser(body) {
  return respond(() => {
    requireRole(requireUser(), ['admin']);
    if (!/^[a-z0-9_.]{3,}$/i.test(body.username ?? '')) throw new ApiError('Tên đăng nhập tối thiểu 3 ký tự', 'validation', { fields: { username: 'Không hợp lệ' } });
    if ((body.password ?? '').length < 6) throw new ApiError('Mật khẩu tối thiểu 6 ký tự', 'validation', { fields: { password: 'Tối thiểu 6 ký tự' } });
    if (db.users.some((u) => u.username === body.username)) throw new ApiError('Tên đăng nhập đã tồn tại', 'conflict', { fields: { username: 'Đã tồn tại' } });
    const u = {
      _id: oid(), username: body.username, password: fakeHash(body.password), full_name: body.full_name || body.username,
      role: body.role || 'user', telegram_chat_id: body.telegram_chat_id || null, is_active: true, failed_attempts: 0, locked_until: null, created_at: iso(),
    };
    db.users.push(u);
    return pub(u);
  });
}

export function updateUser(id, body) {
  return respond(() => {
    const me = requireUser();
    requireRole(me, ['admin']);
    const u = must(byId(db.users, id), 'tài khoản');
    if (id === me._id && body.role && body.role !== 'admin') throw new ApiError('Không thể tự hạ quyền của chính mình', 'validation');
    for (const k of ['full_name', 'role', 'telegram_chat_id', 'is_active']) if (k in body) u[k] = body[k];
    if (body.is_active === true) u.locked_until = null;
    return pub(u);
  });
}

export function resetUserPassword(id, new_password) {
  return respond(() => {
    requireRole(requireUser(), ['admin']);
    if ((new_password ?? '').length < 6) throw new ApiError('Mật khẩu tối thiểu 6 ký tự', 'validation');
    const u = must(byId(db.users, id), 'tài khoản');
    u.password = fakeHash(new_password);
    u.locked_until = null;
    return { ok: true };
  });
}

export function deleteUser(id) {
  return respond(() => {
    const me = requireUser();
    requireRole(me, ['admin']);
    if (id === me._id) throw new ApiError('Không thể xóa chính mình', 'validation');
    db.users = db.users.filter((u) => u._id !== id);
    Object.keys(db.tokens).forEach((k) => db.tokens[k] === id && delete db.tokens[k]);
    db.devices.forEach((d) => (d.shared_with = d.shared_with.filter((x) => x !== id)));
  });
}

// ================================================================ API: danh mục

export const listTypes = () => respond(() => (requireUser(), db.types));
export const listComponentModels = () => respond(() => (requireUser(), db.component_models));
export const listDeviceModels = () => respond(() => (requireUser(), db.device_models));

// ================================================================ API: vị trí (places)

export function listPlaces() {
  return respond(() => {
    const u = requireUser();
    // vị trí của mình + vị trí chứa thiết bị được chia sẻ
    const shared = db.devices.filter((d) => d.shared_with.includes(u._id)).map((d) => byId(db.places, d.place_id)).filter(Boolean);
    const sharedIds = new Set(shared.flatMap((p) => [p._id, ...p.ancestors]));
    return db.places.filter((p) => p.owner_id === u._id || sharedIds.has(p._id)).sort((a, b) => a.order - b.order);
  });
}

const PARENTS = { home: [], floor: ['home'], room: ['home', 'floor'], zone: ['room'] };

// Tên vị trí không trùng với vị trí khác cùng cấp (không phân biệt hoa/thường)
function assertUniquePlaceName(u, name, parentId, selfId = null) {
  const key = name.trim().toLocaleLowerCase('vi');
  const dup = db.places.find((x) => x._id !== selfId && x.owner_id === u._id && x.parent_id === (parentId ?? null) && x.name.toLocaleLowerCase('vi') === key);
  if (dup) throw new ApiError(`Đã có "${dup.name}" ở cấp này`, 'validation', { fields: { name: 'Tên bị trùng' } });
}

export function createPlace({ name, type, parent_id }) {
  return respond(() => {
    const u = requireUser();
    if (!String(name ?? '').trim()) throw new ApiError('Nhập tên', 'validation', { fields: { name: 'Bắt buộc' } });
    const parent = parent_id ? must(byId(db.places, parent_id), 'vị trí cha') : null;
    if (parent && parent.owner_id !== u._id) throw new ApiError('Vị trí cha không thuộc về bạn', 'forbidden');
    if (!PARENTS[type] || (parent ? !PARENTS[type].includes(parent.type) : type !== 'home'))
      throw new ApiError('Loại vị trí không hợp lệ ở cấp này', 'validation');
    assertUniquePlaceName(u, name, parent?._id);
    const p = {
      _id: oid(), owner_id: u._id, name: name.trim(), type, parent_id: parent?._id ?? null,
      ancestors: parent ? [...parent.ancestors, parent._id] : [], img_url: null,
      order: db.places.filter((x) => x.parent_id === (parent?._id ?? null)).length + 1,
    };
    db.places.push(p);
    return p;
  });
}

export function updatePlace(id, { name, parent_id }) {
  return respond(() => {
    const u = requireUser();
    const p = must(byId(db.places, id), 'vị trí');
    if (p.owner_id !== u._id) throw new ApiError('Không có quyền', 'forbidden');
    if (name !== undefined) {
      if (!String(name).trim()) throw new ApiError('Nhập tên', 'validation', { fields: { name: 'Bắt buộc' } });
      assertUniquePlaceName(u, name, parent_id ?? p.parent_id, p._id);
      p.name = name.trim();
    }
    if (parent_id && parent_id !== p.parent_id) {
      const parent = must(byId(db.places, parent_id), 'vị trí cha');
      if (!PARENTS[p.type].includes(parent.type) || parent._id === p._id || parent.ancestors.includes(p._id))
        throw new ApiError('Không thể chuyển tới vị trí này', 'validation');
      assertUniquePlaceName(u, p.name, parent._id, p._id);
      const oldLen = p.ancestors.length;
      p.parent_id = parent._id;
      p.ancestors = [...parent.ancestors, parent._id];
      // cập nhật ancestors của cả cây con (database-design.md 3.3)
      db.places.filter((x) => x.ancestors.includes(p._id)).forEach((x) => (x.ancestors = [...p.ancestors, ...x.ancestors.slice(oldLen)]));
    }
    return p;
  });
}

export function deletePlace(id) {
  return respond(() => {
    const u = requireUser();
    const p = must(byId(db.places, id), 'vị trí');
    if (p.owner_id !== u._id) throw new ApiError('Không có quyền', 'forbidden');
    if (db.places.some((x) => x.parent_id === id)) throw new ApiError('Hãy xóa hoặc chuyển các vị trí con trước', 'conflict');
    const n = db.devices.filter((d) => d.place_id === id).length;
    if (n) throw new ApiError(`Vị trí còn ${n} thiết bị. Hãy chuyển thiết bị sang vị trí khác trước.`, 'conflict');
    db.places = db.places.filter((x) => x._id !== id);
  });
}

export function placeDevices(id, recursive = true) {
  return respond(() => {
    const u = requireUser();
    const ids = new Set([id]);
    if (recursive) db.places.filter((x) => x.ancestors.includes(id)).forEach((x) => ids.add(x._id));
    return db.devices.filter((d) => ids.has(d.place_id) && canSee(u, d)).map(withOnline);
  });
}

// ================================================================ API: thiết bị

export function myDevices() {
  return respond(() => {
    const u = requireUser();
    return db.devices.filter((d) => d.owner_id === u._id || d.shared_with.includes(u._id)).map(withOnline);
  }, 80);
}

export function listDevices({ search = '', registered = '', page: p = 1, limit = 10 } = {}) {
  return respond(() => {
    requireRole(requireUser(), ['admin', 'developer']);
    const s = search.toLowerCase();
    const list = db.devices.filter(
      (d) => (!s || d.device_name.toLowerCase().includes(s)) && (registered === '' || (registered === 'true') === !!d.owner_id),
    );
    return page(list.map(withOnline), { page: p, limit });
  });
}

export function cloneDevices({ device_model_id, quantity }) {
  return respond(() => {
    requireRole(requireUser(), ['admin', 'developer']);
    const m = must(byId(db.device_models, device_model_id), 'mẫu thiết bị');
    const n = Math.min(50, Math.max(1, Number(quantity) || 1));
    const base = db.devices.filter((d) => d.device_model_id === m._id).length;
    return Array.from({ length: n }, (_, i) => {
      const d = {
        _id: oid(), device_model_id: m._id, type_id: m.type_id, device_name: `${m.name} #${base + i + 1}`, url_img: null,
        registration_code: regCode(), owner_id: null, shared_with: [], place_id: null, registered_at: null, last_seen: null,
        mode: 'custom', offline_alert_id: null, created_at: iso(),
      };
      db.devices.push(d);
      m.components.forEach((cmId) => {
        const cm = byId(db.component_models, cmId);
        db.components.push({
          _id: oid(), device_id: d._id, component_model_id: cmId, name: cm.label, mode: 'off',
          value: cm.kind === 'sensor' ? null : cm.metric === 'rgb_color' ? { ...RGB_DEFAULT } : 0, value_at: null,
          topic: `data.${cm.name}`, sync: { pending_command_id: null, last_ack_at: null }, last_manual_at: null, held_by: null,
          last_on_value: cm.metric === 'rgb_color' ? { ...RGB_DEFAULT } : cm.metric === 'fan_speed' ? 50 : null, control: [],
        });
      });
      return d;
    });
  }, 300);
}

export function getDevice(id) {
  return respond(() => {
    const u = requireUser();
    const d = must(byId(db.devices, id), 'thiết bị');
    if (!canSee(u, d)) throw new ApiError('Không có quyền xem thiết bị', 'forbidden');
    return withOnline(d);
  });
}

export function registerDevice({ registration_code, place_id, device_name }) {
  return respond(() => {
    const u = requireUser();
    const d = db.devices.find((x) => x.registration_code === String(registration_code ?? '').trim().toUpperCase());
    if (!d) throw new ApiError('Mã đăng ký không đúng', 'not_found', { fields: { registration_code: 'Không đúng' } });
    if (d.owner_id) throw new ApiError('Thiết bị đã có chủ', 'conflict', { fields: { registration_code: 'Đã được đăng ký' } });
    const p = must(byId(db.places, place_id), 'vị trí');
    if (p.owner_id !== u._id) throw new ApiError('Vị trí không thuộc về bạn', 'forbidden');
    Object.assign(d, { owner_id: u._id, place_id: p._id, registered_at: iso(), last_seen: iso(), device_name: device_name?.trim() || d.device_name });
    return withOnline(d);
  }, 300);
}

export function updateDevice(id, body) {
  return respond(() => {
    const u = requireUser();
    const d = must(byId(db.devices, id), 'thiết bị');
    if (!isStaff(u) && d.owner_id !== u._id) throw new ApiError('Chỉ chủ thiết bị được sửa', 'forbidden');
    if (body.device_name !== undefined) {
      if (!String(body.device_name).trim()) throw new ApiError('Nhập tên thiết bị', 'validation');
      d.device_name = body.device_name.trim();
    }
    if (body.place_id) {
      const p = must(byId(db.places, body.place_id), 'vị trí');
      if (p.owner_id !== d.owner_id) throw new ApiError('Vị trí không thuộc chủ thiết bị', 'forbidden');
      d.place_id = p._id;
    }
    if (body.shared_with) d.shared_with = body.shared_with.filter((x) => x !== d.owner_id);
    if (body.mode && body.mode !== d.mode) {
      d.mode = body.mode;
      // Ép bật / ép tắt: đưa mọi bộ phận chấp hành về trạng thái tương ứng
      if (body.mode !== 'custom' && isOnline(d) && sim.broker) {
        compsOf(d)
          .filter((c) => cmOf(c).kind === 'actuator')
          .forEach((c) => {
            const payload = body.mode === 'off' ? { mode: 'off', val: 0 } : { mode: 'on', val: c.last_on_value ?? cmOf(c).range?.max ?? 100 };
            if (!sameState(c, payload)) sendCommand(c, payload, 'dashboard', { issued_by: u._id });
          });
      }
      if (body.mode === 'custom') {
        // đánh giá lại quy tắc ở bản đo kế tiếp
        db.threshold_rules.forEach((r) => {
          if (compsOf(d).some((c) => c._id === r.auto_action?.component_id) && db.rule_states[r._id]) db.rule_states[r._id].auto_active = false;
        });
      }
    }
    emit('device', withOnline(d));
    return withOnline(d);
  });
}

export function unregisterDevice(id) {
  return respond(() => {
    const u = requireUser();
    const d = must(byId(db.devices, id), 'thiết bị');
    if (!isStaff(u) && d.owner_id !== u._id) throw new ApiError('Chỉ chủ thiết bị được gỡ', 'forbidden');
    Object.assign(d, { owner_id: null, place_id: null, shared_with: [], registered_at: null, last_seen: null, mode: 'custom' });
    const ids = new Set(compsOf(d).map((c) => c._id));
    db.threshold_rules.forEach((r) => (ids.has(r.component_id) || ids.has(r.auto_action?.component_id)) && (r.enabled = false));
    db.schedules.forEach((s) => ids.has(s.component_id) && (s.enabled = false));
    return { ok: true };
  });
}

export function deviceStatus(id) {
  return respond(() => {
    const d = must(byId(db.devices, id), 'thiết bị');
    return {
      online: isOnline(d),
      last_seen: d.last_seen,
      seconds_since_last_seen: d.last_seen ? Math.round((now() - new Date(d.last_seen).getTime()) / 1000) : null,
      offline_after_seconds: PARAMS.OFFLINE_AFTER_S,
    };
  }, 50);
}

export function deviceLatest(id) {
  return respond(() => {
    const u = requireUser();
    const d = must(byId(db.devices, id), 'thiết bị');
    if (!canSee(u, d)) throw new ApiError('Không có quyền xem thiết bị', 'forbidden');
    return { components: compsOf(d).map(latestEntry) };
  }, 60);
}

// Mọi component trong các thiết bị người dùng xem được (collection components)
export function listComponents() {
  return respond(() => {
    const u = requireUser();
    const devs = new Set(db.devices.filter((d) => d.owner_id && (d.owner_id === u._id || d.shared_with.includes(u._id))).map((d) => d._id));
    return db.components.filter((c) => devs.has(c.device_id)).map(componentView);
  }, 80);
}

// Dữ liệu lịch sử: sensor_readings (+ sensor_readings_hourly khi khoảng dài)
export function deviceData(id, { componentModelId, from, to, limit = 1000 }) {
  return respond(() => {
    const u = requireUser();
    const d = must(byId(db.devices, id), 'thiết bị');
    if (!canSee(u, d)) throw new ApiError('Không có quyền xem thiết bị', 'forbidden');
    const c = must(compsOf(d).find((x) => x.component_model_id === componentModelId), 'linh kiện');
    const cm = cmOf(c);
    const t1 = Math.min(to ? new Date(to).getTime() : now(), now());
    const t0 = Math.max(from ? new Date(from).getTime() : t1 - 6 * 3600e3, new Date(d.registered_at ?? d.created_at).getTime());
    if (!(t0 < t1) || !d.registered_at) return { items: [], count: 0, aggregated: false };
    const max = Math.min(Number(limit) || 1000, 1000);
    const step = Math.max(30e3, (t1 - t0) / max);
    const aggregated = step > 30e3;
    const ref = now();
    const off = deviceOffset(d);
    const items = [];
    for (let t = t0; t <= t1; t += step) {
      if (cm.kind === 'actuator') {
        const hist = c.control.filter((x) => new Date(x.ts).getTime() <= t);
        const last = hist[hist.length - 1];
        const val = last && last.mode === 'on' ? (typeof last.val === 'object' ? 1 : last.val) : 0;
        items.push({ ts: iso(t), value: val });
      } else if (inOutage(t, ref)) {
        items.push({ ts: iso(t), value: null });
      } else {
        const v = syntheticValue(cm.metric, t) + off;
        items.push({ ts: iso(t), value: Math.round(v * 10) / 10 });
      }
    }
    // ghép bản đo vừa nhận
    if (!aggregated) {
      const live = (db.live[c._id] || []).filter((p) => p.valid && p.t >= t0 && p.t <= t1);
      if (live.length) {
        const first = live[0].t;
        return { items: items.filter((p) => new Date(p.ts).getTime() < first).concat(live.map((p) => ({ ts: iso(p.t), value: p.v }))), count: items.length, aggregated };
      }
    }
    return { items, count: items.length, aggregated };
  }, 200);
}

export function deviceControl(id, { componentModelId, from, limit = 30 }) {
  return respond(() => {
    const d = must(byId(db.devices, id), 'thiết bị');
    const c = must(compsOf(d).find((x) => x.component_model_id === componentModelId), 'linh kiện');
    const f = from ? new Date(from).getTime() : 0;
    return { items: c.control.filter((x) => new Date(x.ts).getTime() >= f).slice().reverse().slice(0, limit) };
  });
}

export function deviceCommands(id, { limit = 10 } = {}) {
  return respond(() => ({ items: db.commands.filter((c) => c.device_id === id).slice(0, limit) }));
}

// UC03-1 / UC03-2: lệnh từ Dashboard
// Body giống backend nhóm: { model | componentModelId, mode: 'on'|'off', val? }
export function sendDeviceCommand(id, { componentModelId, model, mode, val }) {
  return respond(() => {
    const u = requireUser();
    const d = must(byId(db.devices, id), 'thiết bị');
    if (!canSee(u, d)) throw new ApiError('Không có quyền điều khiển', 'forbidden');
    if (mode !== 'on' && mode !== 'off') throw new ApiError('mode phải là "on" hoặc "off"', 'validation');
    const c = compsOf(d).find((x) => x.component_model_id === componentModelId || cmOf(x).name === model);
    if (!c) throw new ApiError('Thiết bị không có linh kiện này', 'validation');
    const cm = cmOf(c);
    if (cm.kind !== 'actuator') throw new ApiError('Chỉ điều khiển được thiết bị chấp hành', 'validation');
    if (d.mode !== 'custom') throw new ApiError(`Thiết bị đang ở chế độ ${d.mode === 'on' ? 'Ép bật' : 'Ép tắt'}. Chuyển về Tự động để điều khiển tay.`, 'mode');
    if (!isOnline(d)) throw new ApiError('Thiết bị đang offline', 'offline');
    if (!sim.broker) throw new ApiError('Không gửi được lệnh: máy chủ mất kết nối Adafruit IO', 'broker');

    // Đổi màu khi đèn đang tắt → chỉ lưu màu (UC03-1 A1)
    if (cm.metric === 'rgb_color' && mode === 'off' && c.mode === 'off' && val && typeof val === 'object') {
      c.value = val;
      c.last_on_value = val;
      emit('component', componentView(c));
      return pushCommand({ ...newCommand(c, { mode: 'off', val }, 'dashboard', { issued_by: u._id }), status: 'success', reason: 'Đèn đang tắt: đã lưu màu', latency_ms: 0 });
    }
    if (budgetLeft() < 2) throw new ApiError('Hệ thống đang bận, thử lại sau vài giây', 'busy');
    let v = val;
    // Công tắc (vd đèn LED) không cần val: bật = mức tối đa
    if (mode === 'on' && (v == null || cm.type === 'switch')) v = cm.type === 'switch' ? cm.range?.max ?? 100 : c.last_on_value ?? cm.range?.max ?? 100;
    if (mode === 'on' && cm.range && typeof v === 'number' && (v < cm.range.min || v > cm.range.max))
      throw new ApiError(`Giá trị phải trong khoảng ${cm.range.min} – ${cm.range.max}`, 'validation');
    if (mode === 'on' && cm.min_start != null && typeof v === 'number' && v < cm.min_start)
      throw new ApiError(`${cm.label} chỉ chạy từ mức ${cm.min_start} trở lên`, 'validation');
    c.last_manual_at = iso();
    c.held_by = mode === 'on' ? 'user' : null;
    return sendCommand(c, { mode: mode === 'on' ? 'on' : 'off', val: mode === 'on' ? v : 0 }, 'dashboard', { issued_by: u._id });
  });
}

// UC03-3: toàn bộ lịch sử điều khiển
export function listCommands({ device_id, source, status, from, to, page: p = 1, limit = 12 } = {}) {
  return respond(() => {
    const u = requireUser();
    const f = from ? new Date(from).getTime() : -Infinity;
    const t = to ? new Date(to).getTime() : Infinity;
    const list = db.commands.filter((c) => {
      const d = byId(db.devices, c.device_id);
      if (!d || !canSee(u, d)) return false;
      if (device_id && c.device_id !== device_id) return false;
      if (source && c.source !== source) return false;
      if (status && c.status !== status) return false;
      const at = new Date(c.sent_at).getTime();
      return at >= f && at <= t;
    });
    return page(list, { page: p, limit });
  });
}

// ================================================================ API: threshold_rules

export function listRules() {
  return respond(() => {
    const u = requireUser();
    return db.threshold_rules
      .filter((r) => canSeeComp(u, r.component_id))
      .map((r) => ({ ...r, state: { breach_count: db.rule_states[r._id]?.count ?? 0, auto_active: !!db.rule_states[r._id]?.auto_active } }));
  });
}

export function saveRule(input) {
  return respond(() => {
    const u = requireUser();
    const fields = {};
    const c = byId(db.components, input.component_id);
    const cm = c && cmOf(c);
    const min = input.min === '' || input.min == null ? null : Number(input.min);
    const max = input.max === '' || input.max == null ? null : Number(input.max);
    if (!String(input.name ?? '').trim()) fields.name = 'Đặt tên cho quy tắc';
    if (!c || !canSeeComp(u, c._id) || cm.kind !== 'sensor') fields.component_id = 'Chọn cảm biến';
    if (min == null && max == null) fields.min = fields.max = 'Nhập ít nhất một ngưỡng';
    if (cm?.range) {
      if (min != null && (Number.isNaN(min) || min < cm.range.min || min > cm.range.max)) fields.min = `Trong khoảng ${cm.range.min} – ${cm.range.max}`;
      if (max != null && (Number.isNaN(max) || max < cm.range.min || max > cm.range.max)) fields.max = `Trong khoảng ${cm.range.min} – ${cm.range.max}`;
    }
    if (min != null && max != null && !fields.min && !fields.max && min >= max) fields.max = 'Ngưỡng trên phải lớn hơn ngưỡng dưới';
    const channels = [...new Set(['dashboard', ...(input.channels ?? [])])];
    const aa = input.auto_action;
    if (aa?.enabled) {
      const t = byId(db.components, aa.component_id);
      if (!t || !canSeeComp(u, t._id) || cmOf(t).kind !== 'actuator') fields.target = 'Chọn thiết bị chấp hành';
    }
    if (Object.keys(fields).length) throw new ApiError('Quy tắc chưa hợp lệ', 'validation', { fields });
    if (channels.includes('telegram') && !u.telegram_chat_id && !byId(db.threshold_rules, input._id)?.channels.includes('telegram'))
      throw new ApiError('Bạn chưa khai báo Telegram chat ID. Thêm ở trang Thông tin cá nhân hoặc bỏ chọn Telegram.', 'telegram_unlinked');
    // Một thiết bị chấp hành chỉ thuộc một quy tắc tự động đang bật (UC04-2 A2)
    if (aa?.enabled && input.enabled !== false) {
      const other = db.threshold_rules.find((r) => r._id !== input._id && r.enabled && r.auto_action?.enabled && r.auto_action.component_id === aa.component_id);
      if (other) throw new ApiError(`Thiết bị đã được quy tắc "${other.name}" điều khiển. Tắt quy tắc đó hoặc chọn thiết bị khác.`, 'conflict');
    }
    let r = input._id && byId(db.threshold_rules, input._id);
    const data = {
      name: input.name.trim(),
      component_id: c._id,
      metric: cm.metric,
      min,
      max,
      severity: input.severity === 'danger' ? 'danger' : 'warning',
      channels,
      enabled: input.enabled !== false,
      auto_action: aa?.enabled
        ? { enabled: true, component_id: aa.component_id, on_breach: aa.on_breach, on_resolve: aa.on_resolve ?? null }
        : aa
          ? { ...aa, enabled: false }
          : null,
      updated_by: u._id,
      updated_at: iso(),
    };
    if (r) Object.assign(r, data);
    else {
      r = { _id: oid(), created_by: u._id, ...data };
      db.threshold_rules.push(r);
    }
    const st = db.rule_states[r._id];
    if (st) {
      st.auto_active = false;
      if (!r.enabled && st.alert_id) {
        resolveAlert(byId(db.alerts, st.alert_id), 'Quy tắc bị tắt', false);
        st.alert_id = null;
        st.count = 0;
      }
    }
    const target = r.auto_action?.enabled && byId(db.components, r.auto_action.component_id);
    const warning =
      target && cm.metric === 'light' && cmOf(target).metric === 'rgb_color' && deviceOf(target).place_id === deviceOf(c).place_id
        ? 'Đèn bật có thể làm cảm biến ánh sáng đọc sáng hơn và gây bật/tắt liên tục.'
        : null;
    return { rule: r, warning };
  });
}

export function deleteRule(id) {
  return respond(() => {
    requireUser();
    const st = db.rule_states[id];
    if (st?.alert_id) resolveAlert(byId(db.alerts, st.alert_id), 'Quy tắc đã bị xóa', false);
    db.threshold_rules = db.threshold_rules.filter((r) => r._id !== id);
    delete db.rule_states[id];
  });
}

// ================================================================ API: schedules

export function listSchedules() {
  return respond(() => {
    const u = requireUser();
    return db.schedules.filter((s) => canSeeComp(u, s.component_id));
  });
}

export function saveSchedule(input) {
  return respond(() => {
    const u = requireUser();
    const fields = {};
    const c = byId(db.components, input.component_id);
    if (!c || !canSeeComp(u, c._id) || cmOf(c).kind !== 'actuator') fields.component_id = 'Chọn thiết bị';
    if (!/^\d{1,2} \d{1,2} \* \* (\*|[0-6](,[0-6])*)$/.test(input.cron ?? '')) fields.cron = 'Giờ hoặc ngày lặp không hợp lệ';
    if (!String(input.name ?? '').trim()) fields.name = 'Đặt tên cho lịch';
    if (Object.keys(fields).length) throw new ApiError('Lịch hẹn chưa hợp lệ', 'validation', { fields });
    // Trùng lịch: cùng thiết bị, cùng giờ, ngày giao nhau, khác hành động (UC04-3 A2)
    const days = (cron) => {
      const d = cron.split(' ')[4];
      return d === '*' ? [0, 1, 2, 3, 4, 5, 6] : d.split(',').map(Number);
    };
    const [m, h] = input.cron.split(' ');
    const clash = db.schedules.find((s) => {
      if (s._id === input._id || !s.enabled || s.component_id !== c._id) return false;
      const [sm, sh] = s.cron.split(' ');
      return Number(sm) === Number(m) && Number(sh) === Number(h) && JSON.stringify(s.action) !== JSON.stringify(input.action) && days(s.cron).some((x) => days(input.cron).includes(x));
    });
    if (clash && input.enabled !== false) throw new ApiError(`Trùng với lịch "${clash.name}" của cùng thiết bị`, 'conflict');

    let s = input._id && byId(db.schedules, input._id);
    const data = {
      name: input.name.trim(),
      component_id: c._id,
      action: input.action.mode === 'on' ? { mode: 'on', value: input.action.value } : { mode: 'off' },
      cron: input.cron,
      timezone: 'Asia/Ho_Chi_Minh',
      enabled: input.enabled !== false,
      next_run_at: nextCronRun(input.cron),
    };
    if (s) Object.assign(s, data);
    else {
      s = { _id: oid(), last_run_at: null, created_by: u._id, ...data };
      db.schedules.push(s);
    }
    return s;
  });
}

export function setScheduleEnabled(id, enabled) {
  return respond(() => {
    requireUser();
    const s = must(byId(db.schedules, id), 'lịch hẹn');
    s.enabled = enabled;
    s.next_run_at = enabled ? nextCronRun(s.cron) : s.next_run_at;
    return s;
  });
}

export function deleteSchedule(id) {
  return respond(() => {
    requireUser();
    db.schedules = db.schedules.filter((s) => s._id !== id);
  });
}

// ================================================================ API: alerts

const visibleAlert = (u, a) => !a.device_ids.length || a.device_ids.some((id) => {
  const d = byId(db.devices, id);
  return d && canSee(u, d);
});

export function listAlerts({ place_id, metric, severity, status, from, to, page: p = 1, limit = 10 } = {}) {
  return respond(() => {
    const u = requireUser();
    const f = from ? new Date(from).getTime() : -Infinity;
    const t = to ? new Date(to).getTime() : Infinity;
    const placeIds = place_id ? new Set([place_id, ...db.places.filter((x) => x.ancestors.includes(place_id)).map((x) => x._id)]) : null;
    const list = db.alerts
      .filter((a) => {
        if (!visibleAlert(u, a)) return false;
        if (placeIds && !placeIds.has(a.place_id)) return false;
        if (metric && a.metric !== metric) return false;
        if (severity && a.severity !== severity) return false;
        if (status && a.status !== status) return false;
        const at = new Date(a.triggered_at).getTime();
        return at >= f && at <= t;
      })
      .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || new Date(b.triggered_at) - new Date(a.triggered_at));
    return page(list, { page: p, limit });
  });
}

export function alertSummary() {
  return respond(() => {
    const u = requireUser();
    const list = db.alerts.filter((a) => visibleAlert(u, a));
    return {
      active: list.filter((a) => a.status === 'active').length,
      unseen: list.filter((a) => !a.seen).length,
      recent: [...list].sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at)).slice(0, 5),
    };
  }, 50);
}

export function getAlert(id) {
  return respond(() => {
    requireUser();
    const a = must(byId(db.alerts, id), 'cảnh báo');
    if (!a.seen) {
      a.seen = true;
      emit('alert', a);
    }
    return { ...a, acknowledged_by_name: byId(db.users, a.acknowledged_by)?.full_name ?? null };
  });
}

export function acknowledgeAlert(id) {
  return respond(() => {
    const u = requireUser();
    const a = must(byId(db.alerts, id), 'cảnh báo');
    if (a.status !== 'active') {
      const who = byId(db.users, a.acknowledged_by)?.full_name;
      throw new ApiError(a.status === 'acknowledged' ? `Cảnh báo đã được ${who ?? 'người khác'} xác nhận trước đó` : 'Cảnh báo đã đóng', 'conflict', {
        alert: { ...clone(a), acknowledged_by_name: who ?? null },
      });
    }
    Object.assign(a, { status: 'acknowledged', acknowledged_by: u._id, acknowledged_at: iso(), seen: true });
    emit('alert', a);
    return { ...a, acknowledged_by_name: u.full_name };
  });
}

// ================================================================ thời gian thực

export function subscribe(fn) {
  start();
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const isSocketConnected = () => sim.socket;

// ================================================================ bảng mô phỏng

export const simulator = {
  state: () => ({ ...sim, overrides: { ...sim.overrides } }),
  sensors: () => {
    const paths = placePaths(db.places);
    return db.components
      .filter((c) => cmOf(c).kind === 'sensor' && deviceOf(c).owner_id)
      .map((c) => ({ _id: c._id, label: `${cmOf(c).label} · ${deviceOf(c).device_name}`, unit: cmOf(c).unit, place: paths.get(deviceOf(c).place_id) }));
  },
  dropSocket(seconds = 10) {
    sim.socket = false;
    emitConnection();
    setTimeout(() => {
      sim.socket = true;
      emitConnection();
    }, seconds * 1000);
  },
  setBroker(v) {
    sim.broker = v;
    emit('notice', { tone: v ? 'green' : 'red', title: v ? 'Đã kết nối lại Adafruit IO' : 'Máy chủ mất kết nối Adafruit IO', text: v ? 'Dữ liệu tiếp tục được cập nhật.' : 'Không nhận được dữ liệu và không gửi được lệnh.' });
  },
  setBoard(v) {
    sim.board = v;
    if (!v) {
      const past = iso(now() - PARAMS.OFFLINE_AFTER_S * 1000 - 1000);
      db.devices.forEach((d) => d.owner_id && d.last_seen && (d.last_seen = past));
    }
    save();
  },
  setOverride(componentId, value) {
    if (value === null || value === '' || value === undefined) delete sim.overrides[componentId];
    else sim.overrides[componentId] = Number(value);
  },
  setNoAck(v) {
    sim.noAck = v;
  },
  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    location.reload();
  },
};
