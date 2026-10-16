import { useState } from 'react';
import { api } from '../api/index.js';
import { Icon } from './icons.jsx';
import { Toggle } from './ui.jsx';

// Bảng mô phỏng để demo các luồng ngoại lệ khi chưa nối phần cứng. Chỉ hiện ở chế độ giả lập.
export default function SimPanel() {
  const sim = api.simulator;
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [target, setTarget] = useState('');
  const [value, setValue] = useState('35');
  if (!sim) return null;
  const s = sim.state();
  const sensors = open ? sim.sensors() : [];
  const sel = target || sensors[0]?._id || '';
  const refresh = () => force((n) => n + 1);

  return (
    <>
      <button className="sim-fab" onClick={() => setOpen((v) => !v)}>
        <Icon name="flask" size={16} /> Mô phỏng
      </button>
      {open && (
        <div className="sim-panel">
          <div className="sim-row">
            <h3>Bảng mô phỏng (dữ liệu giả)</h3>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Đóng">
              <Icon name="x" />
            </button>
          </div>
          <p className="muted small">Dùng để trình diễn các luồng ngoại lệ khi chưa nối phần cứng thật.</p>

          <div className="sim-row">
            <span>Bo Yolo:Bit đang chạy</span>
            <Toggle on={s.board} onChange={(v) => { sim.setBoard(v); refresh(); }} label="Bo Yolo:Bit" />
          </div>
          <div className="sim-row">
            <span>Kết nối Adafruit IO</span>
            <Toggle on={s.broker} onChange={(v) => { sim.setBroker(v); refresh(); }} label="Adafruit IO" />
          </div>
          <div className="sim-row">
            <span>Thiết bị không phản hồi lệnh</span>
            <Toggle on={s.noAck} onChange={(v) => { sim.setNoAck(v); refresh(); }} label="Không phản hồi" />
          </div>

          <div className="stack-sm">
            <span>Ép giá trị cảm biến</span>
            <select className="input" value={sel} onChange={(e) => setTarget(e.target.value)}>
              {sensors.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.label}
                </option>
              ))}
            </select>
            <div className="inline" style={{ flexWrap: 'nowrap' }}>
              <input className="input" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
              <button className="btn btn-outline btn-sm" onClick={() => { sim.setOverride(sel, value); refresh(); }}>
                Áp dụng
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { sim.setOverride(sel, null); refresh(); }}>
                Bỏ
              </button>
            </div>
            {Object.keys(s.overrides).length > 0 && <span className="small muted">Đang ép {Object.keys(s.overrides).length} cảm biến. Cần 3 lần đo liên tiếp để sinh cảnh báo.</span>}
          </div>

          <div className="stack-sm">
            <button className="btn btn-outline btn-sm" onClick={() => sim.dropSocket(10)}>
              Ngắt kết nối thời gian thực 10 giây
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => sim.reset()}>
              Khôi phục dữ liệu ban đầu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
