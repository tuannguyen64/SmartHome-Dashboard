import { FigmaIcon } from '../components/icons.jsx';
import './auth.css';

export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <section className="auth-intro">
        <FigmaIcon name="circleSm" size={220} className="auth-circle-sm" />
        <FigmaIcon name="circleLg" size={420} className="auth-circle-lg" />
        <div className="auth-brand">
          <FigmaIcon name="brandMark" size={36} />
          SmartHome
        </div>
        <div className="auth-hero">
          <h1>
            Ngôi nhà của bạn,
            <br />
            trong tầm tay.
          </h1>
          <p>Theo dõi nhiệt độ, độ ẩm, ánh sáng theo thời gian thực. Điều khiển thiết bị, hẹn giờ và nhận cảnh báo khi vượt ngưỡng.</p>
          <div className="auth-metrics">
            <div className="auth-metric">
              <div className="sym">
                <FigmaIcon name="thermometerWhite" width={10} height={24} />
              </div>
              <strong>Nhiệt độ</strong>
              <span>& độ ẩm</span>
            </div>
            <div className="auth-metric">
              <div className="sym">💡</div>
              <strong>Ánh sáng</strong>
              <span>đèn LED RGB</span>
            </div>
            <div className="auth-metric">
              <div className="sym">🌀</div>
              <strong>Quạt mini</strong>
              <span>0 – 100 %</span>
            </div>
          </div>
        </div>
        <p className="auth-copy">© 2026 SmartHome · Đồ án DADN-CNPM</p>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <div className="auth-mobile-brand">
            <span className="hdr-logo">
              <FigmaIcon name="house" size={17} />
            </span>
            SmartHome
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
