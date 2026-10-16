import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';

// Một kết nối thời gian thực dùng chung cho cả ứng dụng (WebSocket / giả lập)
const RealtimeContext = createContext({ connected: true, reconnects: 0 });

export function RealtimeProvider({ children }) {
  const [connected, setConnected] = useState(true);
  const [reconnects, setReconnects] = useState(0);

  useEffect(() => {
    setConnected(api.isSocketConnected());
    return api.subscribe((msg) => {
      if (msg.type !== 'connection') return;
      setConnected(msg.payload.connected);
      // UC02-1 A4: nối lại được thì các trang tải lại giá trị mới nhất
      if (msg.payload.connected) setReconnects((n) => n + 1);
    });
  }, []);

  return <RealtimeContext.Provider value={{ connected, reconnects }}>{children}</RealtimeContext.Provider>;
}

export const useRealtimeStatus = () => useContext(RealtimeContext);

// Nghe các sự kiện có type nằm trong `types`
export function useLiveEvent(types, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  const key = Array.isArray(types) ? types.join(',') : types;
  useEffect(() => {
    const list = key.split(',');
    return api.subscribe((msg) => {
      if (list.includes(msg.type)) ref.current(msg.payload, msg.type);
    });
  }, [key]);
}
