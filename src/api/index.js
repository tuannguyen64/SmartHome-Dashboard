// Chọn nguồn dữ liệu: giả lập trong trình duyệt (mặc định) hoặc backend Express thật.
// Đặt VITE_USE_MOCK=false trong file .env để dùng backend thật.
import * as mock from './mock/server.js';
import * as http from './http.js';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const api = USE_MOCK ? mock : http;
export { ApiError } from './errors.js';
export { getToken, setToken } from './session.js';
