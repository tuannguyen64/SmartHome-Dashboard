import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Automation from './Automation.jsx';
import Schedules from './Schedules.jsx';

// Trang "Tự động": gộp ngưỡng cảnh báo / quy tắc tự động và hẹn giờ
export default function AutoPage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Tự động</h1>
          <p className="page-sub">Ngưỡng cảnh báo, quy tắc tự động và lịch hẹn giờ · chỉ chạy khi thiết bị ở chế độ Tự động</p>
        </div>
      </div>
      <Automation embedded />
      <Schedules embedded />
    </div>
  );
}
