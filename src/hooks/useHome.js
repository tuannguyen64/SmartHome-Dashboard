import { useMemo } from 'react';
import { api, USE_MOCK } from '../api/index.js';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { PARAMS } from '../utils/constants.js';
import { placePaths } from '../utils/format.js';
import { useApi } from './useApi.js';

// Dữ liệu "ngôi nhà" của người dùng: places + devices (của tôi / được chia sẻ) + components
export function useHome() {
  const res = useApi(
    async () => {
      const [places, devices, components] = await Promise.all([api.listPlaces(), api.myDevices(), api.listComponents()]);
      return { places, devices, components };
    },
    [],
    { poll: USE_MOCK ? 0 : PARAMS.POLL_MS },
  );

  // Cập nhật tại chỗ khi có sự kiện (chế độ giả lập)
  useLiveEvent('component', (c) =>
    res.setData((d) => (d ? { ...d, components: d.components.map((x) => (x._id === c._id ? c : x)) } : d)),
  );
  useLiveEvent('device', (dev) =>
    res.setData((d) =>
      d
        ? {
            ...d,
            devices: d.devices.map((x) => (x._id === dev._id ? { ...x, ...dev } : x)),
            components: d.components.map((x) => (x.device_id === dev._id ? { ...x, device_mode: dev.mode, device_online: dev.online } : x)),
          }
        : d,
    ),
  );

  const derived = useMemo(() => {
    const d = res.data;
    if (!d) return null;
    const paths = placePaths(d.places);
    const deviceById = new Map(d.devices.map((x) => [x._id, x]));
    const compById = new Map(d.components.map((x) => [x._id, x]));
    const compsOf = (deviceId) => d.components.filter((c) => c.device_id === deviceId);
    const sensors = d.components.filter((c) => c.componentModel.kind === 'sensor');
    const actuators = d.components.filter((c) => c.componentModel.kind === 'actuator');
    const label = (c) => `${c.componentModel.label} · ${c.device_name}`;
    return { ...d, paths, deviceById, compById, compsOf, sensors, actuators, label };
  }, [res.data]);

  return { ...res, home: derived };
}
