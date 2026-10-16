# SmartHome – Web Dashboard (React + Vite)

Giao diện web cho đồ án **DADN-CNPM – Hệ thống Nhà thông minh**. Giao diện dựng theo thiết kế Figma *DADN-CNPM*. Dữ liệu theo **thiết kế MongoDB của nhóm** (`database-design.md`) và cùng API với backend Express của nhóm, tức các API mà repo `FrontEnd-SmartHome` đang dùng.

## Chạy thử

Cần Node.js 18 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Trên Windows PowerShell, nếu báo lỗi "running scripts is disabled" thì dùng `npm.cmd run dev`.

**Tài khoản demo** (chỉ có ở chế độ giả lập, khai báo trong `src/api/mock/seed.js`). Mọi tài khoản dùng chung mật khẩu **123456**.

| Tên đăng nhập | Vai trò | Ghi chú |
|---|---|---|
| `admin` | Quản trị viên | Vào được trang Quản trị: tài khoản, thiết bị, mã đăng ký |
| `dev` | Developer | Trang Quản trị, chỉ phần thiết bị và mã đăng ký |
| `tuan` | Người dùng | Chủ nhà: có cây vị trí và 4 thiết bị (quạt, đèn, rèm, cảm biến môi trường) |
| `lan` | Người dùng | Chưa có vị trí riêng, được chia sẻ quạt phòng khách (dùng để thử tạo nhà, đăng ký thiết bị) |

Linh kiện khớp backend và firmware của nhóm (xem `HUONG-DAN-TRIEN-KHAI.md`): `dht20-temp`, `dht20-hum`, `light` (cảm biến); `fan-dc` (quạt, chỉ chạy từ 30%), `led` (đèn LED RGB **chỉ bật/tắt, bật là sáng đỏ**), `servo-sg90` (rèm, 0–180°).

Thiết bị chưa đăng ký có mã ở **Quản trị → Thiết bị & mã đăng ký**. Đăng nhập `tuan`, vào **Thiết bị → Đăng ký thiết bị**, nhập mã đó để nhận thêm thiết bị.

## Hai chế độ dữ liệu

| Chế độ | Cách bật | Ghi chú |
|---|---|---|
| Giả lập (mặc định) | `VITE_USE_MOCK=true` | Backend giả chạy trong trình duyệt (`src/api/mock`), dữ liệu lưu ở localStorage. Bo "gửi" số đo mỗi 5 giây. Có nút **Mô phỏng** ở góc dưới bên trái. |
| Backend thật | Tạo `.env` từ `.env.example`, đặt `VITE_USE_MOCK=false` | Vite chuyển tiếp `/api` tới `http://localhost:5000` (đổi bằng `VITE_API_TARGET`). |

## Mô hình dữ liệu (theo database-design.md)

- `places`: cây **nhà → tầng → phòng → khu vực** (`parent_id`, `ancestors`).
- `types` → `component_models` (sensor/actuator, metric, unit, range, min_start) → `device_models` → `devices`, mỗi thiết bị gồm nhiều `components`.
- `devices.mode`: `custom` (Tự động) / `on` (Ép bật) / `off` (Ép tắt).
- `threshold_rules`: ngưỡng `min`/`max` + `severity` + `channels` (dashboard/telegram/lcd) + `auto_action` (on_breach / on_resolve).
- `schedules`: `component_id` + `action` + `cron` + `timezone`.
- `alerts`, `commands` (source: dashboard / automation / schedule / button).
- `users`: `username`, `role` (admin / developer / user), `telegram_chat_id`.

## Các màn hình

| Đường dẫn | Màn hình | Có trong Figma |
|---|---|---|
| `/dang-nhap`, `/dang-ky` | Đăng nhập / đăng ký bằng tên đăng nhập | ✔ |
| `/` | Tổng quan: giá trị cảm biến, thiết bị nhóm theo vị trí, điều khiển, chế độ thiết bị, cảnh báo gần đây | ✔ |
| `/bieu-do` | Biểu đồ 1 giờ / 6 giờ / 24 giờ / 7 ngày / tùy chọn, có đường ngưỡng, xuất CSV | ✔ |
| `/tu-dong-hoa` | `threshold_rules`: sửa nhanh ngưỡng (trái), hành động tự động NẾU…THÌ… (phải), lịch sử kích hoạt | ✔ |
| `/hen-gio` | `schedules` theo cron: giờ + hằng ngày / theo thứ | ✔ |
| `/canh-bao` | `alerts`: lọc, chi tiết, kết quả gửi, nút "Đã biết" | thêm mới |
| `/lich-su` | `commands`: lịch sử điều khiển | thêm mới |
| `/thiet-bi` | Cây vị trí + thiết bị: đăng ký bằng mã, đổi tên, chuyển vị trí, gỡ | thêm mới |
| `/quan-tri` | Quản lý tài khoản (admin), nhân bản thiết bị và mã đăng ký (admin/dev) | thêm mới |
| `/ca-nhan` | Hồ sơ, Telegram chat ID, đổi mật khẩu | ✔ |

## API backend cần có

Xem `src/api/http.js`.

**Đã có ở backend nhóm** (FrontEnd-SmartHome đang dùng): `/auth/login|register|me`, `/users`, `/users/me/password`, `/types`, `/component-models`, `/device-models`, `/places` và `/places/:id/devices`, `/devices` cùng `/devices/mine|register|:id|:id/status|latest|data|control|commands|unregister`.

**Cần bổ sung** (theo database-design.md):

| API | Dùng cho |
|---|---|
| `GET /components` | Tổng quan nhanh hơn. Nếu không có, web tự ghép từ `/devices/mine` + `/devices/:id/latest` |
| `GET /commands?device_id&source&status&from&to&page&limit` | Lịch sử điều khiển toàn bộ |
| `GET/POST/PATCH/DELETE /threshold-rules` | Tự động hóa |
| `GET/POST/PATCH/DELETE /schedules` | Hẹn giờ |
| `GET /alerts`, `GET /alerts/summary`, `GET /alerts/:id`, `POST /alerts/:id/ack` | Cảnh báo |
| `PATCH /users/me` | Sửa họ tên, Telegram chat ID |
| `/devices/:id/latest`: thêm `component_id` và `mode` cho mỗi phần tử | Liên kết quy tắc/lịch với component |

Lỗi trả về dạng `{ error, code?, details?: { fields } }`. Cấu trúc dữ liệu chi tiết xem `src/api/mock/server.js`.

## Cấu trúc thư mục

```
src/
  api/          index.js chọn mock/http · http.js gọi backend · mock/ backend giả lập
  components/   Header, layout, Device (điều khiển theo component_model), UI dùng chung, icon Figma
  context/      đăng nhập, toast, thời gian thực
  hooks/        useApi, useHome (places + devices + components), useControl (1 lệnh / 3 giây)
  pages/        các màn hình
  utils/        hằng số, định dạng giờ GMT+7, cron
```
