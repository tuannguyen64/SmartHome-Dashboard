import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';
import { PARAMS } from '../utils/constants.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAction } from './useApi.js';

// Gửi lệnh tới một component chấp hành: tối đa 1 lệnh / 3 giây cho mỗi thiết bị, chỉ gửi lệnh cuối
// (UC03-1 A2, UC03-2 A2, NFR3). `onSent` dùng để tải lại khi backend không có sự kiện thời gian thực.
export function useControl(onSent) {
  const toast = useToast();
  const act = useAction();
  const last = useRef({});
  const timers = useRef({});
  const pending = useRef({});
  const [queued, setQueued] = useState({});

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const send = useCallback(
    (comp, payload) => {
      const key = comp._id;
      pending.current[key] = { comp, payload };
      setQueued((q) => ({ ...q, [comp._id]: payload }));
      clearTimeout(timers.current[key]);

      const fire = async () => {
        const { comp: c, payload: p } = pending.current[key];
        delete pending.current[key];
        last.current[key] = Date.now();
        try {
          // Body giống backend nhóm: model (tên feed) + componentModelId, mode, val
          const body = { model: c.componentModel.name, componentModelId: c.componentModel._id, mode: p.mode };
          if (p.mode === 'on' && p.val != null) body.val = p.val;
          await act(() => api.sendDeviceCommand(c.device_id, body));
          onSent?.();
        } catch (e) {
          toast.error(e.message, c.device_name);
        } finally {
          setQueued((q) => {
            const n = { ...q };
            delete n[c._id];
            return n;
          });
        }
      };

      const wait = Math.max(0, (last.current[key] ?? 0) + PARAMS.MIN_COMMAND_GAP_MS - Date.now());
      if (wait === 0) fire();
      else timers.current[key] = setTimeout(fire, wait);
    },
    [act, toast, onSent],
  );

  return { send, queued };
}

// Trạng thái hiển thị của một actuator: ưu tiên lệnh đang chờ
export function actuatorView(comp, queuedPayload) {
  const isRgb = comp.componentModel.metric === 'rgb_color';
  const on = comp.mode ? comp.mode === 'on' : comp.control?.mode === 'on';
  const base = {
    on,
    level: isRgb ? null : on ? Number(comp.control?.val ?? comp.data?.value ?? 0) : 0,
    color: isRgb ? (comp.data?.value?.color ?? comp.control?.val?.color ?? '#ffcc00') : null,
    pending: !!comp.pending,
  };
  if (!queuedPayload) return base;
  return {
    on: queuedPayload.mode === 'on',
    level: isRgb ? null : queuedPayload.mode === 'on' ? Number(queuedPayload.val ?? base.level) : 0,
    color: isRgb ? (queuedPayload.val?.color ?? base.color) : null,
    pending: true,
  };
}
