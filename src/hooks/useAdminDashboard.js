import { useApi } from './useApi.js';
import { api } from '../api/index.js';
import { useLiveEvent } from '../context/RealtimeContext.jsx';
import { PARAMS } from '../utils/constants.js';

export function useAdminDashboard() {
  const result = useApi(() => api.adminOverview(), [], { poll: PARAMS.POLL_MS });
  useLiveEvent(['device', 'alert', 'command'], () => result.reload({ silent: true }));
  return result;
}
