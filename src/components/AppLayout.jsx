import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { RealtimeProvider, useLiveEvent, useRealtimeStatus } from '../context/RealtimeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { USE_MOCK } from '../api/index.js';
import Header from './Header.jsx';
import SimPanel from './SimPanel.jsx';
import { Icon } from './icons.jsx';
import { Spinner } from './ui.jsx';

function ConnectionBanner() {
  const { connected } = useRealtimeStatus();
  if (connected) return null;
  // UC02-1 A4
  return (
    <div className="banner" role="alert">
      <Icon name="wifiOff" size={16} />
      Mất kết nối máy chủ, đang thử lại…
      <Spinner />
    </div>
  );
}

function Notices() {
  const toast = useToast();
  // SF06: hiển thị nổi bật cảnh báo mới trên mọi Dashboard đang mở
  useLiveEvent('notice', (n) => toast.show({ tone: n.tone, title: n.title, text: n.text, duration: 7000 }));
  // UC03-1 A4: lệnh của người dùng không được xác nhận
  useLiveEvent('command', (c) => {
    if (c.status === 'failed' && c.source === 'dashboard') toast.error(c.reason, 'Thiết bị không phản hồi');
  });
  return null;
}

export default function AppLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready)
    return (
      <div className="empty" style={{ height: '100vh' }}>
        <Spinner />
      </div>
    );
  if (!user) return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  return (
    <RealtimeProvider>
      <Header />
      <ConnectionBanner />
      <main>
        <Outlet />
      </main>
      <Notices />
      {USE_MOCK && <SimPanel />}
    </RealtimeProvider>
  );
}
