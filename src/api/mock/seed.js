// Dữ liệu khởi tạo cho chế độ giả lập, theo đúng các collection trong database-design.md:
// users, types, component_models (collection "models"), device_models, devices, components,
// places, threshold_rules, schedules, alerts, commands.
//
// Tài khoản demo (mọi tài khoản dùng chung mật khẩu 123456):
//   admin – Quản trị viên | dev – Developer
//   tuan  – Người dùng, chủ nhà, có sẵn thiết bị | lan – Người dùng, được chia sẻ quạt

import { syntheticValue } from './synthetic.js';

export const SEED_VERSION = 12;
export const DEMO_PASSWORD = '123456';

// Băm giả cho chế độ demo. Backend thật dùng bcrypt (NFR4).
export function fakeHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `demo$${h.toString(16)}`;
}

// ObjectId giả: 24 ký tự hex
let counter = 0;
export function oid() {
  const t = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const r = Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return t + r + (counter++ % 4096).toString(16).padStart(6, '0');
}

export const regCode = () =>
  Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export const RGB_DEFAULT = { color: '#ffcc00', pixels: [0, 1, 2, 3] };

export function createSeed(now = Date.now()) {
  const H = 3600e3;
  const D = 24 * H;
  const at = (ms) => new Date(now - ms).toISOString();

  // ---------------------------------------------------------------- users
  const mkUser = (username, full_name, role) => ({
    _id: oid(),
    username,
    password: fakeHash(DEMO_PASSWORD),
    full_name,
    role,
    telegram_chat_id: null,
    is_active: true,
    failed_attempts: 0,
    locked_until: null,
    created_at: at(30 * D),
  });
  const admin = mkUser('admin', 'Phạm Minh Quân', 'admin');
  const dev = mkUser('dev', 'Lê Hoàng Nam', 'developer');
  const tuan = mkUser('tuan', 'Nguyễn Đức Tuấn', 'user');
  const lan = mkUser('lan', 'Trần Thị Lan', 'user');

  // ---------------------------------------------------------------- types
  const tFan = { _id: oid(), name: 'Quạt', code: 'fan', url_img: null };
  const tLight = { _id: oid(), name: 'Đèn', code: 'light', url_img: null };
  const tCurtain = { _id: oid(), name: 'Rèm', code: 'curtain', url_img: null };
  const tEnv = { _id: oid(), name: 'Cảm biến môi trường', code: 'env_sensor', url_img: null };

  // ---------------------------------------------------------------- component_models
  // Khớp backend nhóm (HUONG-DAN-TRIEN-KHAI.md): 3 cảm biến + 3 chấp hành = 10 feed Adafruit.
  // name = tên feed (data.<name>), driver = khóa trong DRIVERS của yolobit-main.py
  const mkCm = (o) => ({ _id: oid(), description: '', min_start: null, type: null, ...o });
  const cmTemp = mkCm({ name: 'dht20-temp', label: 'Nhiệt độ', driver: 'dht20_temp', kind: 'sensor', metric: 'temperature', unit: '°C', range: { min: -40, max: 85 } });
  const cmHum = mkCm({ name: 'dht20-hum', label: 'Độ ẩm', driver: 'dht20_hum', kind: 'sensor', metric: 'humidity', unit: '%', range: { min: 0, max: 100 } });
  const cmLight = mkCm({ name: 'light', label: 'Ánh sáng', driver: 'analog_percent', kind: 'sensor', metric: 'light', unit: '%', range: { min: 0, max: 100 } });
  const cmFan = mkCm({ name: 'fan-dc', label: 'Động cơ quạt', driver: 'pwm_percent', kind: 'actuator', metric: 'fan_speed', unit: '%', range: { min: 0, max: 100 }, min_start: 30, type: 'slider', description: 'Quạt chỉ chạy từ mức 30%' });
  const cmLed = mkCm({ name: 'led', label: 'Đèn LED RGB', driver: 'rgb_led_red', kind: 'actuator', metric: 'brightness', unit: '%', range: { min: 0, max: 100 }, type: 'switch', description: 'Bật → sáng đỏ, tắt → tắt hẳn (4 LED)' });
  const cmServo = mkCm({ name: 'servo-sg90', label: 'Servo rèm', driver: 'servo_angle', kind: 'actuator', metric: 'angle', unit: '°', range: { min: 0, max: 180 }, type: 'slider', description: 'Servo SG90 kéo rèm, góc 0–180°' });
  const cms = [cmTemp, cmHum, cmLight, cmFan, cmLed, cmServo];

  // ---------------------------------------------------------------- device_models (4 mẫu như DB của nhóm)
  const dm = (name, type, comps, buttons, description) => ({ _id: oid(), name, type_id: type._id, components: comps.map((c) => c._id), buttons, url_img: null, description });
  const dmFan = dm('Quạt thông minh', tFan, [cmTemp, cmHum, cmFan], 'fan-dc', 'Yolo:Bit + DHT20 + quạt mini');
  const dmLight = dm('Đèn thông minh', tLight, [cmLight, cmLed], 'led', 'Yolo:Bit + cảm biến ánh sáng + LED RGB');
  const dmCurtain = dm('Rèm tự động', tCurtain, [cmLight, cmServo], 'servo-sg90', 'Yolo:Bit + cảm biến ánh sáng + servo SG90');
  const dmEnv = dm('Cảm biến môi trường', tEnv, [cmTemp, cmHum, cmLight], null, 'Yolo:Bit + DHT20 + cảm biến ánh sáng');

  // ---------------------------------------------------------------- places
  const mkPlace = (owner, name, type, parent, order = 1) => ({
    _id: oid(),
    owner_id: owner._id,
    name,
    type,
    parent_id: parent?._id ?? null,
    ancestors: parent ? [...parent.ancestors, parent._id] : [],
    img_url: null,
    order,
  });
  const home = mkPlace(tuan, 'Nhà của Tuấn', 'home');
  const floor1 = mkPlace(tuan, 'Tầng 1', 'floor', home);
  const living = mkPlace(tuan, 'Phòng khách', 'room', floor1, 1);
  const bedroom = mkPlace(tuan, 'Phòng ngủ', 'room', floor1, 2);
  const desk = mkPlace(tuan, 'Góc làm việc', 'zone', bedroom);
  // "lan" chưa có vị trí riêng (giống DB nhóm) – dùng để thử luồng tạo nhà, đăng ký thiết bị

  // ---------------------------------------------------------------- devices + components
  const devices = [];
  const components = [];
  const mkDevice = (model, o = {}) => {
    const d = {
      _id: oid(),
      device_model_id: model._id,
      type_id: model.type_id,
      device_name: model.name,
      url_img: null,
      registration_code: regCode(),
      owner_id: null,
      shared_with: [],
      place_id: null,
      registered_at: null,
      last_seen: null,
      mode: 'custom',
      offline_alert_id: null,
      created_at: at(15 * D),
      ...o,
    };
    devices.push(d);
    model.components.forEach((cmId) => {
      const cm = cms.find((x) => x._id === cmId);
      components.push({
        _id: oid(),
        device_id: d._id,
        component_model_id: cmId,
        name: cm.label,
        mode: 'off',
        value: cm.kind === 'sensor' ? (d.last_seen ? syntheticValue(cm.metric, now) : null) : cm.metric === 'rgb_color' ? { ...RGB_DEFAULT } : 0,
        value_at: d.last_seen,
        topic: `data.${cm.name}`,
        sync: { pending_command_id: null, last_ack_at: null },
        last_manual_at: null,
        held_by: null,
        last_on_value: cm.metric === 'fan_speed' ? 50 : cm.metric === 'rgb_color' ? { ...RGB_DEFAULT } : null,
        control: [],
      });
    });
    return d;
  };

  const fan = mkDevice(dmFan, { device_name: 'Quạt phòng khách', owner_id: tuan._id, place_id: living._id, registered_at: at(10 * D), last_seen: at(3000), shared_with: [lan._id] });
  const lamp = mkDevice(dmLight, { device_name: 'Đèn phòng ngủ', owner_id: tuan._id, place_id: bedroom._id, registered_at: at(10 * D), last_seen: at(3000) });
  const curtain = mkDevice(dmCurtain, { device_name: 'Rèm phòng ngủ', owner_id: tuan._id, place_id: bedroom._id, registered_at: at(9 * D), last_seen: at(3000) });
  mkDevice(dmEnv, { device_name: 'Cảm biến góc làm việc', owner_id: tuan._id, place_id: desk._id, registered_at: at(8 * D), last_seen: at(3000) });
  mkDevice(dmFan); // chưa đăng ký – mã đăng ký xem ở trang Quản trị
  mkDevice(dmLight);
  mkDevice(dmCurtain);

  const comp = (device, cm) => components.find((c) => c.device_id === device._id && c.component_model_id === cm._id);
  const fanMotor = comp(fan, cmFan);
  Object.assign(fanMotor, { mode: 'on', value: 65, last_on_value: 65, value_at: at(50 * 60e3) });
  fanMotor.control.push({ ts: at(50 * 60e3), mode: 'on', val: 65, source: 'command' });
  const led = comp(lamp, cmLed);
  Object.assign(led, { last_on_value: 100 });
  led.control.push({ ts: at(5 * H), mode: 'off', val: 0, source: 'button' });
  const servo = comp(curtain, cmServo);
  Object.assign(servo, { mode: 'on', value: 90, last_on_value: 90, value_at: at(3 * H) });
  servo.control.push({ ts: at(3 * H), mode: 'on', val: 90, source: 'command' });

  // ---------------------------------------------------------------- threshold_rules
  const tempComp = comp(fan, cmTemp);
  const humComp = comp(fan, cmHum);
  const lightComp = comp(lamp, cmLight);
  const threshold_rules = [
    {
      _id: oid(), name: 'Nóng phòng khách', component_id: tempComp._id, metric: 'temperature', min: 18, max: 32, severity: 'warning',
      channels: ['dashboard', 'telegram', 'lcd'], enabled: true,
      auto_action: { enabled: true, component_id: fanMotor._id, on_breach: { mode: 'on', value: 80 }, on_resolve: { mode: 'off' } },
      created_by: tuan._id, updated_at: at(5 * D),
    },
    {
      _id: oid(), name: 'Quá nóng', component_id: tempComp._id, metric: 'temperature', min: null, max: 38, severity: 'danger',
      channels: ['dashboard', 'telegram', 'lcd'], enabled: true, auto_action: null, created_by: tuan._id, updated_at: at(5 * D),
    },
    {
      _id: oid(), name: 'Độ ẩm phòng khách', component_id: humComp._id, metric: 'humidity', min: 40, max: 80, severity: 'warning',
      channels: ['dashboard'], enabled: true, auto_action: null, created_by: tuan._id, updated_at: at(5 * D),
    },
    {
      _id: oid(), name: 'Tối thì bật đèn', component_id: lightComp._id, metric: 'light', min: 15, max: null, severity: 'warning',
      channels: ['dashboard'], enabled: true,
      auto_action: { enabled: true, component_id: led._id, on_breach: { mode: 'on', value: 100 }, on_resolve: { mode: 'off' } },
      created_by: tuan._id, updated_at: at(4 * D),
    },
  ];

  // ---------------------------------------------------------------- schedules
  const sch = (name, c, action, cron, enabled = true) => ({
    _id: oid(), name, component_id: c._id, action, cron, timezone: 'Asia/Ho_Chi_Minh', enabled,
    next_run_at: null, last_run_at: null, created_by: tuan._id,
  });
  const schedules = [
    sch('Bật đèn buổi tối', led, { mode: 'on', value: 100 }, '30 18 * * *'),
    sch('Tắt đèn đi ngủ', led, { mode: 'off' }, '0 23 * * *'),
    sch('Thông gió buổi sáng', fanMotor, { mode: 'on', value: 40 }, '0 6 * * 1,3,5'),
    sch('Mở rèm buổi sáng', servo, { mode: 'on', value: 180 }, '30 6 * * *'),
    sch('Tắt quạt nửa đêm', fanMotor, { mode: 'off' }, '0 1 * * *', false),
  ];

  // ---------------------------------------------------------------- commands
  const commands = [];
  const tpl = [
    { c: fanMotor, src: 'automation', p: { mode: 'on', val: 80 }, st: 'success', ref: threshold_rules[0] },
    { c: fanMotor, src: 'automation', p: { mode: 'off', val: 0 }, st: 'success', ref: threshold_rules[0] },
    { c: led, src: 'schedule', p: { mode: 'on', val: 100 }, st: 'success', ref: schedules[0] },
    { c: led, src: 'schedule', p: { mode: 'off', val: 0 }, st: 'success', ref: schedules[1] },
    { c: fanMotor, src: 'dashboard', p: { mode: 'on', val: 50 }, st: 'success', by: tuan._id },
    { c: led, src: 'dashboard', p: { mode: 'on', val: 100 }, st: 'failed', by: tuan._id, reason: 'Thiết bị không phản hồi trong 5 giây' },
    { c: servo, src: 'schedule', p: { mode: 'on', val: 180 }, st: 'success', ref: schedules[3] },
    { c: fanMotor, src: 'automation', p: { mode: 'on', val: 80 }, st: 'skipped', ref: threshold_rules[0], reason: 'Ưu tiên thao tác tay (15 phút)' },
    { c: fanMotor, src: 'dashboard', p: { mode: 'on', val: 65 }, st: 'success', by: lan._id },
  ];
  for (let i = 0; i < 40; i++) {
    const t = tpl[(i * 5 + 3) % tpl.length];
    commands.push({
      _id: oid(),
      component_id: t.c._id,
      component_model_id: t.c.component_model_id,
      device_id: t.c.device_id,
      source: t.src,
      ref_id: t.ref?._id ?? null,
      ref_name: t.ref?.name ?? null,
      payload: t.p,
      status: t.st,
      reason: t.reason ?? null,
      issued_by: t.by ?? null,
      sent_at: at((i + 1) * 1.7 * H + ((i * 37) % 50) * 60e3),
      latency_ms: t.st === 'success' ? 500 + ((i * 131) % 900) : null,
    });
  }

  // ---------------------------------------------------------------- alerts
  const mkAlert = (o) => ({
    _id: oid(), type: 'threshold', rule_id: null, place_id: null, component_id: null, device_ids: [], metric: null,
    value: null, worst_value: null, threshold: null, severity: 'warning', status: 'resolved', message: '',
    deliveries: [{ channel: 'dashboard', status: 'sent', attempts: 1 }],
    triggered_at: null, resolved_at: null, resolve_reason: null, acknowledged_by: null, acknowledged_at: null, reminded_at: null, seen: true,
    ...o,
  });
  const alerts = [
    mkAlert({
      rule_id: threshold_rules[0]._id, place_id: living._id, component_id: tempComp._id, device_ids: [fan._id], metric: 'temperature',
      value: 32.6, worst_value: 33.1, threshold: { min: 18, max: 32, breached: 'max' },
      message: 'Phòng khách: nhiệt độ 32.6 °C vượt ngưỡng trên 32 °C',
      deliveries: [
        { channel: 'dashboard', status: 'sent', attempts: 1 },
        { channel: 'telegram', status: 'failed', attempts: 3, last_error: 'timeout' },
        { channel: 'lcd', status: 'sent', attempts: 1 },
      ],
      triggered_at: at(26 * H), resolved_at: at(24.5 * H), resolve_reason: 'Giá trị đã trở lại an toàn',
      acknowledged_by: tuan._id, acknowledged_at: at(25.8 * H),
    }),
    mkAlert({
      rule_id: threshold_rules[2]._id, place_id: living._id, component_id: humComp._id, device_ids: [fan._id], metric: 'humidity',
      value: 38, worst_value: 36, threshold: { min: 40, max: 80, breached: 'min' },
      message: 'Phòng khách: độ ẩm 38 % dưới ngưỡng dưới 40 %',
      triggered_at: at(50 * H), resolved_at: at(48 * H), resolve_reason: 'Giá trị đã trở lại an toàn', seen: false,
    }),
    mkAlert({
      type: 'device_offline', place_id: bedroom._id, device_ids: [lamp._id], severity: 'warning',
      message: 'Đèn phòng ngủ mất kết nối',
      triggered_at: at(30 * H), resolved_at: at(28.3 * H), resolve_reason: 'Thiết bị gửi dữ liệu trở lại',
    }),
    mkAlert({
      type: 'control_failed', place_id: bedroom._id, component_id: led._id, device_ids: [lamp._id],
      message: 'Không điều khiển được Đèn LED RGB (lịch "Bật đèn buổi tối") sau 3 lần thử',
      triggered_at: at(74 * H), resolved_at: at(73.5 * H),
    }),
  ];

  return {
    version: SEED_VERSION,
    users: [admin, dev, tuan, lan],
    tokens: {},
    types: [tFan, tLight, tCurtain, tEnv],
    component_models: cms,
    device_models: [dmFan, dmLight, dmCurtain, dmEnv],
    places: [home, floor1, living, bedroom, desk],
    devices,
    components,
    threshold_rules,
    rule_states: {},
    schedules,
    commands,
    alerts,
    live: {},
  };
}
