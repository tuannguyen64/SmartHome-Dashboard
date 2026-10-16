// Giữ token phiên đăng nhập. "Ghi nhớ đăng nhập" → localStorage, ngược lại → sessionStorage.
const KEY = 'smarthome-token';

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

let memoryToken = null;

export function getToken() {
  return memoryToken ?? safe(() => localStorage.getItem(KEY)) ?? safe(() => sessionStorage.getItem(KEY));
}

export function setToken(token, remember) {
  memoryToken = token;
  safe(() => localStorage.removeItem(KEY));
  safe(() => sessionStorage.removeItem(KEY));
  if (!token) return;
  safe(() => (remember ? localStorage : sessionStorage).setItem(KEY, token));
}
