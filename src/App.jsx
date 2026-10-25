import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { isStaff } from './utils/constants.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Overview from './pages/Overview.jsx';
import Charts from './pages/Charts.jsx';
import Automation from './pages/Automation.jsx';
import Schedules from './pages/Schedules.jsx';
import Alerts from './pages/Alerts.jsx';
import ControlHistory from './pages/ControlHistory.jsx';
import PlacesDevices from './pages/PlacesDevices.jsx';
import Admin from './pages/Admin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import AdminLogs from './pages/AdminLogs.jsx';
import AdminSettings from './pages/AdminSettings.jsx';
import Profile from './pages/Profile.jsx';

function StaffOnly({ children }) {
  const { user } = useAuth();
  if (isStaff(user)) return children;
  return (
    <div className="page">
      <div className="alert-box alert-box-red">Bạn không có quyền truy cập trang này.</div>
    </div>
  );
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role === 'admin') return children;
  return <div className="page"><div className="alert-box alert-box-red">Chức năng này chỉ dành cho quản trị viên.</div></div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/dang-nhap" element={<Login />} />
      <Route path="/dang-ky" element={<Register />} />
      <Route element={<AppLayout />}>
        <Route index element={<Overview />} />
        <Route path="bieu-do" element={<Charts />} />
        <Route path="tu-dong-hoa" element={<Automation />} />
        <Route path="hen-gio" element={<Schedules />} />
        <Route path="canh-bao" element={<Alerts />} />
        <Route path="lich-su" element={<ControlHistory />} />
        <Route path="thiet-bi" element={<PlacesDevices />} />
        <Route path="quan-tri" element={<StaffOnly><Navigate to="/admin" replace /></StaffOnly>} />
        <Route path="ca-nhan" element={<Profile />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminOnly><Admin /></AdminOnly>} />
        <Route path="devices" element={<Admin />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="settings" element={<AdminOnly><AdminSettings /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
