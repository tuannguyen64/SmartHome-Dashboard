import { metricInfo, WEEKDAYS } from './constants.js';

// Lưu trữ UTC, hiển thị theo GMT+7 (NFR7)
export const TZ = 'Asia/Ho_Chi_Minh';

const timeFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'long' });

export const fmtTime = (d) => (d ? timeFmt.format(new Date(d)) : '—');
export const fmtDate = (d) => (d ? dateFmt.format(new Date(d)) : '—');
export const fmtDateTime = (d) => (d ? `${dateFmt.format(new Date(d))} ${timeFmt.format(new Date(d))}` : '—');
export const fmtShortDateTime = (d) => (d ? `${shortDateFmt.format(new Date(d))} ${timeFmt.format(new Date(d))}` : '—');
export const fmtWeekday = (d) => {
  const s = weekdayFmt.format(new Date(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Các thành phần ngày/giờ theo GMT+7 của một mốc thời gian
export function vnParts(d) {
  const shifted = new Date(new Date(d).getTime() + 7 * 3600 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

// Mốc UTC ứng với giờ GMT+7 cho trước
export function fromVn(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour - 7, minute));
}

export function greeting(d = new Date()) {
  const h = vnParts(d).hour;
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function fmtValue(metric, value) {
  if (value === null || value === undefined || typeof value === 'object' || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(metricInfo(metric).decimals);
}

export function fmtThreshold(min, max, unit = '') {
  if (min != null && max != null) return `${min} – ${max} ${unit}`.trim();
  if (min != null) return `≥ ${min} ${unit}`.trim();
  if (max != null) return `≤ ${max} ${unit}`.trim();
  return '—';
}

export function timeAgo(d, now = Date.now()) {
  if (!d) return 'chưa có';
  const s = Math.round((now - new Date(d).getTime()) / 1000);
  if (s < 10) return 'vừa xong';
  if (s < 60) return `${s} giây trước`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return fmtShortDateTime(d);
}

// Mô tả một lệnh / hành động { mode, value|val } cho một component_model
export function fmtAction(cm, action) {
  if (!action) return '—';
  const v = action.value ?? action.val;
  if (action.mode !== 'on') return `Tắt ${cm?.label ?? ''}`.trim();
  if (cm?.metric === 'rgb_color') return `Bật ${cm.label}, màu ${v?.color ?? ''}`.trim();
  if (v != null && typeof v !== 'object' && cm?.type !== 'switch') return `Bật ${cm?.label ?? ''} ${v}${cm?.unit ?? ''}`.trim();
  return `Bật ${cm?.label ?? ''}`.trim();
}

// ---------------------------------------------------------------- cron (schedules.cron)
// Giao diện chỉ tạo dạng "phút giờ * * thứ": hằng ngày ("*") hoặc danh sách thứ ("1,3,5", 0 = CN)
export function buildCron(hh, mm, days) {
  const dow = !days || days.length === 0 || days.length === 7 ? '*' : [...days].sort((a, b) => a - b).join(',');
  return `${Number(mm)} ${Number(hh)} * * ${dow}`;
}

export function parseCron(cron) {
  const [m, h, , , dow] = String(cron).trim().split(/\s+/);
  const days = dow === '*' ? null : dow.split(',').map(Number);
  return { hh: String(h).padStart(2, '0'), mm: String(m).padStart(2, '0'), days };
}

export function describeCron(cron) {
  const { hh, mm, days } = parseCron(cron);
  if (!days) return { time: `${hh}:${mm}`, repeat: 'Hằng ngày' };
  const order = WEEKDAYS.map((w) => w.key);
  const label = [...days]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((k) => WEEKDAYS.find((w) => w.key === k)?.short)
    .join(', ');
  return { time: `${hh}:${mm}`, repeat: label };
}

// Lần chạy kế tiếp (GMT+7) của cron dạng trên
export function nextCronRun(cron, from = Date.now()) {
  const { hh, mm, days } = parseCron(cron);
  const p = vnParts(from);
  for (let i = 0; i <= 7; i++) {
    const cand = fromVn(p.year, p.month, p.day + i, Number(hh), Number(mm)).getTime();
    if (cand <= from) continue;
    if (!days || days.includes(vnParts(cand).weekday)) return new Date(cand).toISOString();
  }
  return null;
}

// ---------------------------------------------------------------- places
// Đường dẫn "Nhà › Tầng 1 › Phòng khách" từ danh sách phẳng
export function placePaths(places) {
  const byId = new Map(places.map((p) => [p._id, p]));
  const path = (p) => [...(p.ancestors || []).map((a) => byId.get(a)?.name).filter(Boolean), p.name].join(' › ');
  return new Map(places.map((p) => [p._id, path(p)]));
}

export function toCsv(rows) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === null || c === undefined ? '' : String(c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
