import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtimeStatus } from '../context/RealtimeContext.jsx';

// Gọi API khi mount / khi deps đổi / khi WebSocket nối lại.
export function useApi(fn, deps = [], { reloadOnReconnect = true, poll = 0 } = {}) {
  const { expire } = useAuth();
  const { reconnects } = useRealtimeStatus();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const res = await fnRef.current();
        if (id === seq.current) {
          setData(res);
          setError(null);
        }
        return res;
      } catch (e) {
        if (e.code === 'unauthorized') expire();
        if (id === seq.current) setError(e);
        return null;
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [expire],
  );

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (reloadOnReconnect && reconnects > 0) reload({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnects]);

  // Backend thật chưa có WebSocket → làm mới định kỳ
  useEffect(() => {
    if (!poll) return undefined;
    const t = setInterval(() => reload({ silent: true }), poll);
    return () => clearInterval(t);
  }, [poll, reload]);

  return { data, setData, error, loading, reload };
}

// Bắt lỗi chung của các thao tác ghi: phiên hết hạn → đăng xuất
export function useAction() {
  const { expire } = useAuth();
  return useCallback(
    async (fn) => {
      try {
        return await fn();
      } catch (e) {
        if (e.code === 'unauthorized') expire();
        throw e;
      }
    },
    [expire],
  );
}

// Đồng hồ cập nhật định kỳ (dùng cho "x giây trước")
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
