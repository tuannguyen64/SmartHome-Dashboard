// Tham số mặc định (Đặc tả II.4 + backend nhóm)
export const PARAMS = {
  COMMAND_ACK_TIMEOUT_MS: 5000,
  MIN_COMMAND_GAP_MS: 3000,
  MANUAL_PRIORITY_MS: 15 * 60 * 1000,
  BREACH_COUNT: 3,
  ALERT_COOLDOWN_MS: 10 * 60 * 1000,
  REMIND_AFTER_MS: 15 * 60 * 1000,
  OFFLINE_AFTER_S: 60,
  LOGIN_MAX_FAILS: 5,
  LOGIN_LOCK_MS: 15 * 60 * 1000,
  RETENTION_DAYS: 180,
  POLL_MS: 10000,
};

// Cách hiển thị theo metric của component_model. Metric lạ dùng FALLBACK_METRIC.
export const METRICS = {
  temperature: { label: 'Nhiệt độ', icon: 'thermometer', tint: '#fff2f3', color: '#ef4444', decimals: 1, hysteresis: 1, slider: [0, 50] },
  humidity: { label: 'Độ ẩm', icon: 'drop', tint: '#eff6ff', color: '#2460f5', decimals: 0, hysteresis: 3, slider: [0, 100] },
  light: { label: 'Ánh sáng', icon: 'sun', tint: '#fffbeb', color: '#f59e0b', decimals: 0, hysteresis: 5, slider: [0, 100] },
  fan_speed: { label: 'Tốc độ quạt', icon: 'fan', tint: '#ecfeff', color: '#0891b2', decimals: 0 },
  brightness: { label: 'Đèn LED', icon: 'rainbow', tint: '#fef2f2', color: '#dc2626', decimals: 0 },
  angle: { label: 'Góc rèm', emoji: '🪟', tint: '#eff6ff', color: '#2460f5', decimals: 0 },
  rgb_color: { label: 'Màu đèn', icon: 'rainbow', tint: '#fdf2f8', color: '#db2777', decimals: 0 },
};
export const FALLBACK_METRIC = { label: '', icon: 'bulb', tint: '#f1f5f9', color: '#647896', decimals: 1, hysteresis: 1, slider: [0, 100] };
export const metricInfo = (metric) => METRICS[metric] ?? FALLBACK_METRIC;

export const ROLES = {
  admin: { label: 'Quản trị viên', tone: 'red' },
  developer: { label: 'Developer', tone: 'blue' },
  user: { label: 'Người dùng', tone: 'green' },
};
export const isStaff = (u) => u?.role === 'admin' || u?.role === 'developer';

export const PLACE_TYPES = { home: 'Nhà', floor: 'Tầng', room: 'Phòng', zone: 'Khu vực' };
// Cấp con hợp lệ (khớp backend)
export const CHILD_TYPES = { home: ['floor', 'room'], floor: ['room'], room: ['zone'], zone: [] };
export const PARENT_TYPES = { home: [], floor: ['home'], room: ['home', 'floor'], zone: ['room'] };

// devices.mode
export const DEVICE_MODES = {
  custom: { label: 'Tự động', hint: 'Chạy theo quy tắc, lịch hẹn và điều khiển tay' },
  on: { label: 'Ép bật', hint: 'Luôn bật, bỏ qua mọi tự động hóa' },
  off: { label: 'Ép tắt', hint: 'Luôn tắt, bỏ qua mọi tự động hóa (vẫn gửi cảnh báo)' },
};

export const SEVERITY = {
  warning: { label: 'Cảnh báo', tone: 'amber' },
  danger: { label: 'Nguy hiểm', tone: 'red' },
};

export const ALERT_STATUS = {
  active: { label: 'Đang mở', tone: 'red' },
  acknowledged: { label: 'Đã xác nhận', tone: 'amber' },
  resolved: { label: 'Đã đóng', tone: 'green' },
};

export const ALERT_TYPES = {
  threshold: 'Vượt ngưỡng',
  device_offline: 'Thiết bị mất kết nối',
  system_offline: 'Hệ thống mất kết nối',
  control_failed: 'Không điều khiển được thiết bị',
  escalation: 'Cảnh báo khẩn',
};

// threshold_rules.channels
export const CHANNELS = {
  dashboard: 'Dashboard',
  telegram: 'Telegram',
  lcd: 'Tại chỗ (đèn/LCD)',
};

// commands.source
export const COMMAND_SOURCES = {
  dashboard: 'Người dùng',
  automation: 'Quy tắc',
  schedule: 'Lịch hẹn',
  button: 'Nút trên bo',
};

// commands.status
export const COMMAND_STATUS = {
  success: { label: 'Thành công', tone: 'green' },
  failed: { label: 'Thất bại', tone: 'red' },
  skipped: { label: 'Bỏ qua', tone: 'gray' },
  pending: { label: 'Đang chờ', tone: 'blue' },
};

export const WEEKDAYS = [
  { key: 1, short: 'T2' },
  { key: 2, short: 'T3' },
  { key: 3, short: 'T4' },
  { key: 4, short: 'T5' },
  { key: 5, short: 'T6' },
  { key: 6, short: 'T7' },
  { key: 0, short: 'CN' },
];

export const RGB_PALETTE = ['#ffffff', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#2460f5', '#800080'];
