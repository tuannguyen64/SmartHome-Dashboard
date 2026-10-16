// Sinh dữ liệu cảm biến giả có tính chu kỳ ngày/đêm, ổn định theo thời gian
// (cùng một mốc thời gian luôn cho cùng một giá trị) để biểu đồ không nhảy khi tải lại.

function noise(t, seed) {
  const x = Math.sin(t / 60000 * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5; // -0.5 .. 0.5
}

function vnHour(t) {
  const d = new Date(t + 7 * 3600 * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function syntheticValue(metric, t) {
  const h = vnHour(t);
  const day = Math.floor(t / 86400000);
  const dayShift = noise(day * 86400000, 3) * 2;
  switch (metric) {
    case 'temperature': {
      const v = 29 + dayShift + 3.6 * Math.sin((2 * Math.PI * (h - 8.5)) / 24) + noise(t, 1) * 0.6;
      return Math.round(v * 10) / 10;
    }
    case 'humidity': {
      const v = 66 - dayShift * 2 - 11 * Math.sin((2 * Math.PI * (h - 8.5)) / 24) + noise(t, 2) * 2;
      return Math.round(Math.min(100, Math.max(0, v)));
    }
    case 'light': {
      const sun = h > 6 && h < 18.5 ? Math.sin((Math.PI * (h - 6)) / 12.5) : 0;
      const v = 3 + 85 * sun + noise(t, 4) * 4;
      return Math.round(Math.min(100, Math.max(0, v)));
    }
    default:
      return 0;
  }
}

// Khoảng mất kết nối giả để minh hoạ biểu đồ đứt đoạn (UC02-2 A4)
export function inOutage(t, now) {
  const start = now - 30 * 3600 * 1000;
  return t > start && t < start + 100 * 60 * 1000;
}
