# CLAUDE.md – SmartHome Web Dashboard (đồ án DADN-CNPM)

Ghi chú bàn giao cho phiên Claude kế tiếp. Trả lời người dùng bằng **tiếng Việt**.

## Dự án
- Web Dashboard cho hệ thống **Nhà thông minh** (đồ án đa ngành DADN-CNPM). Người dùng (Tuấn) phụ trách **frontend web từ Figma**.
- Thư mục: `C:\Users\Tuan\OneDrive\Desktop\Đồ án đa ngành\web` (Desktop đồng bộ OneDrive).
- GitHub: https://github.com/tuannguyen64/SmartHome-Dashboard (**public**, nhánh `main`). Commit bằng tên `tuannguyen64`, email noreply GitHub (đã đặt trong `git config` cục bộ của repo).
- `gh` CLI đã cài và đăng nhập `tuannguyen64` (`C:\Program Files\GitHub CLI\gh.exe`). Khi người dùng nói "update git": quét secret → commit → push.
- Stack: React 18 + Vite 5 + React Router 6 + Recharts. Chạy: `npm.cmd run dev` (PowerShell chặn `npm.ps1`) → http://localhost:5173. Node: `C:\Program Files\nodejs`.

## Nguồn thiết kế / tài liệu
- Figma: file key `hElDnWwzg5yNwFxVVkocYf` (DADN-CNPM), đọc qua connector Figma. 6 frame: Đăng nhập 78:366, Tổng quan 78:2264, Biểu đồ 92:295, Tự động hóa 96:836, Hẹn giờ 100:1204, Thông tin cá nhân 107:1353. Font Roboto (dashboard) / Arimo (login), màu chính `#2460f5`, frame 2000px → thu ~0.72.
- Thư mục cha `Đồ án đa ngành\` có: đặc tả (`Dac-ta-he-thong-Nha-thong-minh.docx`), `database-design.md`, `Thiết kế MongoDB…docx`, `HUONG-DAN-TRIEN-KHAI.md` (**chứa key thật – không đọc to, không commit**), `atlas-credentials.env` (**bí mật**), ảnh kiến trúc, 2 PDF tài liệu môn (chưa đọc được – thiếu poppler).
- Repo nhóm (đã clone để tham khảo, không sửa): `FrontEnd-SmartHome/` (web cũ của tuancapoo, React 19, gọi backend cổng 5000), `Hardware_SmartHome/` (firmware Yolo:Bit `yolobit-main.py` + giả lập `sim/gui_sim.py`), `mock-backend/` (backend giả Node thuần mình viết để xem web cũ).
- **Backend thật** (Node/Express, MongoDB Atlas, Adafruit IO 2 tài khoản up/down, S3) nằm ở máy bạn khác (`D:\db\backend`), **không có trên máy này**.

## Quyết định đã chốt
- Giao diện theo Figma; **dữ liệu theo MongoDB của nhóm** + API backend nhóm (không theo đặc tả 02/10 ở các chỗ mâu thuẫn).
- Đăng nhập bằng **username**; role `admin | developer | user`; trang `/quan-tri` cho staff.
- `places` dạng cây home > floor > room > zone; `devices.mode` custom/on/off; `threshold_rules` gộp ngưỡng + `auto_action`; `schedules` dùng `cron`.
- Khớp phần cứng thật: linh kiện `dht20-temp`, `dht20-hum`, `light`, `fan-dc` (min_start 30, chặn dưới 30), `led` (**chỉ bật/tắt, sáng đỏ**, type switch), `servo-sg90` (0–180°). 4 mẫu: Quạt, Đèn, Rèm, Cảm biến môi trường.
- Lệnh gửi: `POST /devices/:id/commands` body `{model, componentModelId, mode, val?}`.
- `VITE_USE_MOCK` mặc định true → backend giả trong trình duyệt (`src/api/mock/server.js`, dữ liệu localStorage, tick 5s, nút "Mô phỏng"). `false` → `src/api/http.js`, Vite proxy `/api` → `VITE_API_TARGET` (mặc định :5000).
- Tài khoản demo (mock): `admin` (Nguyễn Đức Tuấn), `dev` (Bùi Phước Thịnh), `tuan` (Nguyễn Đức Tuấn). Mật khẩu ghi trong README – không đọc to mật khẩu trong chat, chỉ trỏ tới README.

## Cấu trúc code
- `src/api/` index (chọn mock/http), http.js, mock/{seed,server,synthetic}.js, session.js, errors.js
- `src/hooks/` useApi (poll khi không mock), useHome (places+devices+components), useControl (1 lệnh/3s)
- `src/components/` Header, AppLayout, Device (ActuatorControl theo component_model), ui.jsx, icons.jsx, SimPanel
- `src/pages/` Login, Register, Overview, Charts, Automation, Schedules, Alerts, ControlHistory, PlacesDevices, Admin, Profile
- CSS: styles.css (token), components/layout.css, pages/{pages,overview,auth}.css. `main.jsx` import CSS chung **trước** App.

## Backend nhóm chưa có (web đã có giao diện, chỉ chạy ở mock)
`/threshold-rules`, `/schedules`, `/alerts`, `/commands` (toàn cục), `/components`, `PATCH /users/me`. http.js đã báo lỗi thân thiện "Backend hiện chưa có chức năng này".

## Việc có thể làm tiếp (bạn trong nhóm đề xuất)
1. Thêm trang Developer: Loại thiết bị, Loại linh kiện, Mẫu thiết bị + **Xuất JSON** cho firmware (API backend đã có: `/types`, `/component-models`, `/device-models`, `/device-models/:id/export`).
2. Hướng dẫn chạy giả lập Yolo:Bit `Hardware_SmartHome/sim/gui_sim.py` (cần Python + paho-mqtt).
3. Viết đặc tả API `threshold_rules` cho nhóm backend.
- Chưa test kỹ: lưu quy tắc/lịch mới, CRUD vị trí, đăng ký thiết bị bằng mã, nhân bản thiết bị, giao diện mobile của bản mới.

## Bảo mật
- Không commit/đọc to nội dung `HUONG-DAN-TRIEN-KHAI.md`, `atlas-credentials.env`. Đã cảnh báo người dùng chuyển 2 file ra khỏi OneDrive.
- Mật khẩu demo trùng mật khẩu DB thật của nhóm → nhắc đổi khi deploy backend.
