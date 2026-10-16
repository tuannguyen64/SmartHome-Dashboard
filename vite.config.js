import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Khi dùng backend thật (VITE_USE_MOCK=false), /api được chuyển tiếp tới backend Express của nhóm
const target = process.env.VITE_API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target, changeOrigin: true } } },
  preview: { port: 5173, proxy: { '/api': { target, changeOrigin: true } } },
});
