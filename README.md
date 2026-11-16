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
| `admin` | Quản trị viên (kỹ sư IT) | Tài khoản, thiết bị + danh mục phần cứng, nhật ký hệ thống, cấu hình cảnh báo |
| `dev` | Kỹ thuật viên (role `developer`) | Lắp đặt tại nhà khách, thiết bị mình lắp, mẫu thiết bị, lịch sử lệnh |
| `tuan` | Người dùng | Chủ nhà: có cây vị trí và 4 thiết bị (quạt, đèn, rèm, cảm biến môi trường) |

Linh kiện khớp backend và firmware của nhóm (xem `HUONG-DAN-TRIEN-KHAI.md`): `dht20-temp`, `dht20-hum`, `light` (cảm biến); `fan-dc` (quạt, chỉ chạy từ 30%), `led` (đèn LED RGB **chỉ bật/tắt, bật là sáng đỏ**), `servo-sg90` (rèm, 0–180°).

Người dùng không tự đăng ký thiết bị. Kỹ thuật viên đăng nhập `dev`, vào **Lắp đặt**, chọn khách hàng và phòng rồi nhập mã in trên bo (mã của thiết bị còn trong kho xem ở **Thiết bị**). Thiết bị thuộc về khách và ghi lại người lắp.

## Hai chế độ dữ liệu

| Chế độ | Cách bật | Ghi chú |
|---|---|---|
| Giả lập (mặc định) | `VITE_USE_MOCK=true` | Backend giả chạy trong trình duyệt (`src/api/mock`), dữ liệu lưu ở localStorage. Bo "gửi" số đo mỗi 5 giây. Có nút **Mô phỏng** ở góc dưới bên trái. |
| Backend thật | Tạo `.env` từ `.env.example`, đặt `VITE_USE_MOCK=false` | Vite chuyển tiếp `/api` tới `http://localhost:5000` (đổi bằng `VITE_API_TARGET`). |

## Chạy với backend thật (my-express-app)

1. Backend: trong thư mục `my-express-app`, điền `.env` (Mongo Atlas, Adafruit, tùy chọn `TELEGRAM_BOT_TOKEN`) rồi `npm install` và `npm run dev` (cổng 5000).
2. Web: tạo `.env` từ `.env.example` (`VITE_USE_MOCK=false`), rồi `npm run dev` và mở http://localhost:5173.

Web dùng các API của backend: `/auth`, `/users`, `/types`, `/component-models`, `/device-models`, `/places`, `/devices/...`
(gồm `/devices/:id/schedules`, `/devices/:id/commands`), `/alert-rules`, `/alerts`, `/admin/overview`.
`src/api/http.js` chuyển dữ liệu theo thiết bị của backend sang dạng "component" mà giao diện dùng.
Trang quản trị dùng thêm `/admin/logs`, `/admin/settings`, `/admin/commands`, `/admin/customers`, `/devices/install`, `/devices/:id/owner-info`.

Vai trò: `admin` và `developer` (kỹ thuật viên) chỉ dùng khu quản trị (`/admin`, `/developer`), không có nhà/thiết bị riêng.
Muốn dùng nhà thông minh thì tạo một tài khoản `user`.

## Mô hình dữ liệu (theo database-design.md)

- `places`: cây **nhà → tầng → phòng → khu vực** (`parent_id`, `ancestors`).
- `types` → `component_models` (sensor/actuator, metric, unit, range, min_start) → `device_models` → `devices`, mỗi thiết bị gồm nhiều `components`.
- `devices.mode`: `custom` (Tự động) / `on` (Ép bật) / `off` (Ép tắt).
- `threshold_rules`: ngưỡng `min`/`max` + `severity` + `channels` (dashboard/telegram/lcd) + `auto_action` (on_breach / on_resolve).
- `schedules`: `component_id` + `action` + `cron` + `timezone`.
- `alerts`, `commands` (source: dashboard / automation / schedule / button).
- `users`: `username`, `role` (admin / developer = kỹ thuật viên / user), `email`, `phone`, `address`, `telegram_chat_id`.
- `devices.installed_by`, `installed_at`: kỹ thuật viên đã lắp thiết bị cho khách.

## Các màn hình

| Đường dẫn | Màn hình | Có trong Figma |
|---|---|---|
| `/dang-nhap`, `/dang-ky` | Đăng nhập / đăng ký bằng tên đăng nhập | ✔ |
| `/` | Tổng quan: giá trị cảm biến, thiết bị nhóm theo vị trí, điều khiển, chế độ thiết bị, cảnh báo gần đây | ✔ |
| `/bieu-do` | Biểu đồ 1 giờ / 6 giờ / 24 giờ / 7 ngày / tùy chọn, có đường ngưỡng, xuất CSV | ✔ |
| `/tu-dong` | Tự động: ngưỡng cảm biến + hành động NẾU…THÌ… và hẹn giờ (gộp hai trang cũ) | ✔ |
| `/canh-bao` | `alerts`: lọc, chi tiết, kết quả gửi, nút "Đã biết" | thêm mới |
| `/lich-su` | `commands`: lịch sử điều khiển | thêm mới |
| `/thiet-bi` | Cây vị trí + thiết bị: đổi tên, chuyển vị trí, gỡ | thêm mới |
| `/admin` | Tổng quan toàn hệ thống |
| `/admin/users` | Quản lý mọi tài khoản (chỉ admin) |
| `/admin/devices` | Hai tab: kho thiết bị và danh mục phần cứng (loại, linh kiện, mẫu) |
| `/admin/devices/:id` | Chi tiết thiết bị: chủ sở hữu, người lắp, quy tắc tự động, telemetry; thu hồi hoặc xóa |
| `/admin/logs` | Nhật ký hệ thống (chỉ admin) |
| `/admin/settings` | Cấu hình cảnh báo và server (chỉ admin) |
| `/developer` | Tổng quan cho kỹ thuật viên |
| `/developer/lap-dat` | Lắp đặt tại nhà khách: chọn khách + phòng, nhập mã in trên bo |
| `/developer/devices` | Thiết bị trong kho và thiết bị mình đã lắp; `/developer/devices/:id` chi tiết, thu hồi |
| `/developer/catalog` | Danh mục phần cứng (chỉ thêm/sửa mẫu thiết bị), xuất JSON cho firmware |
| `/developer/commands` | Lịch sử lệnh của các thiết bị mình đã lắp |
| `/quan-tri` | Đường dẫn cũ, tự chuyển tới `/admin` |
| `/ca-nhan` | Hồ sơ, Telegram chat ID, đổi mật khẩu | ✔ |

## Phân quyền khu quản trị

- `admin` (kỹ sư IT): toàn quyền tài khoản, thiết bị, danh mục phần cứng, nhật ký và cấu hình. Chỉ admin được xóa hẳn thiết bị.
- `developer` (kỹ thuật viên lắp đặt): thấy thiết bị còn trong kho và thiết bị do mình lắp; lắp thiết bị cho khách; thu hồi thiết bị mình lắp về kho; thêm/sửa mẫu thiết bị; xem lịch sử lệnh thiết bị của mình. Không xem nhật ký hệ thống, không quản lý tài khoản.
- `user`: giao diện nhà thông minh, không vào được khu quản trị.
- Đăng xuất nằm ở trang **Thông tin cá nhân**. Server kiểm tra quyền ở từng endpoint, không dựa vào việc ẩn menu.
- Ở chế độ giả lập, dữ liệu lưu trong `localStorage` (khóa `smarthome-mongo-mock`); nút **Thử kênh** chỉ mô phỏng, không gửi Telegram/LCD.

Lỗi trả về dạng `{ error, code?, details?: { fields } }`. Cấu trúc dữ liệu chi tiết xem `src/api/mock/server.js` và `src/api/http.js`.

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
