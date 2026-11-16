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
| `admin` | Quản trị viên | Dashboard, user, thiết bị, nhật ký, cấu hình cảnh báo |
| `dev` | Developer | Dashboard, thiết bị và nhật ký hệ thống |
| `tuan` | Người dùng | Chủ nhà: có cây vị trí và 4 thiết bị (quạt, đèn, rèm, cảm biến môi trường) |

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
| `/admin` | Dashboard toàn hệ thống và điều hướng Admin/Developer |
| `/admin/users` | Quản lý tài khoản (chỉ admin) |
| `/admin/devices` | Danh sách thiết bị, nhân bản và mã đăng ký (admin/dev) |
| `/admin/logs` | Audit đăng nhập, thay đổi cấu hình, lệnh phần cứng (admin/dev) |
| `/admin/settings` | Cấu hình chính sách cảnh báo và sức khỏe server (chỉ admin) |
| `/developer` | Dashboard giám sát dành riêng cho developer |
| `/developer/catalog` | Tra cứu loại thiết bị, loại linh kiện, mẫu thiết bị và xuất cấu hình JSON cho firmware |
| `/developer/devices` | Cấp mã, lọc kho thiết bị, xuất mã đăng ký CSV |
| `/developer/diagnostics` | Chọn thiết bị để xem trạng thái kết nối, telemetry, linh kiện và lịch sử lệnh |
| `/developer/logs` | Xem nhật ký hệ thống dành cho developer |
| `/quan-tri` | Đường dẫn cũ, tự chuyển tới `/admin` |
| `/ca-nhan` | Hồ sơ, Telegram chat ID, đổi mật khẩu | ✔ |

## Giao diện Admin và Developer

### Quyền truy cập và điều hướng

- `admin`: toàn quyền với dashboard, quản lý tài khoản, thiết bị, audit log và cấu hình cảnh báo.
- `developer`: workspace riêng tại `/developer` gồm dashboard, danh mục phần cứng, cấp mã/kho thiết bị, chẩn đoán telemetry/lệnh và audit log; không được quản lý người dùng hoặc thay đổi cấu hình hệ thống.
- `user`: tiếp tục dùng giao diện người dùng; không truy cập được các trang Admin.
- Sau khi đăng nhập, tài khoản `admin` được chuyển về `/admin`, `developer` về `/developer`. Menu tài khoản cung cấp lối sang hồ sơ và các trang dành cho người dùng.
- `/quan-tri` là đường dẫn cũ và tự chuyển về khu vực `/admin`.

### Các màn hình

| Trang | Chức năng |
|---|---|
| `/admin` | KPI tổng user/thiết bị/cảnh báo/server, số liệu cảm biến online, thiết bị offline/cảnh báo đang mở, lưu lượng, uptime thiết bị, tỷ lệ lệnh lỗi, độ trễ và xu hướng sự cố. |
| `/admin/users` | Tìm theo họ tên, username, email; lọc vai trò/trạng thái; xem số thiết bị; sửa thông tin/quyền, khóa/mở khóa, đặt lại mật khẩu, xem audit log theo user. |
| `/admin/devices` | Tìm thiết bị/chủ sở hữu; lọc trạng thái đăng ký/kết nối, loại và vị trí; xem chủ sở hữu, đường dẫn vị trí, mẫu, thời điểm kết nối; nhân bản mẫu để cấp mã đăng ký mới. |
| `/admin/logs` | Lọc audit theo user, thiết bị, mức độ, ngày và từ khóa; phân trang, xuất trang hiện tại thành CSV. |
| `/admin/settings` | Cấu hình ngưỡng min/max theo metric, mức độ, kênh nhận, gửi thử kênh, thời gian offline/cooldown/nhắc lại và thời hạn lưu audit. |

### Mock, dữ liệu thật và giới hạn

- Ở chế độ mock, dữ liệu quản trị được lưu trong `localStorage` dưới khóa `smarthome-mongo-mock`; bộ mô phỏng sinh dữ liệu cảm biến/lệnh theo chu kỳ. Bộ lọc, tìm kiếm, phân trang, cấu hình, sự kiện audit và biểu đồ dùng state/API mock, không phải telemetry của server thật.
- Nút **Thử kênh** ghi audit và mô phỏng kết quả; không gửi Telegram, không tác động LCD/bo mạch và không gửi thông báo ra ngoài. Dashboard là kênh tại chỗ.
- Thời hạn audit chỉ cắt dữ liệu mock cũ ở client. Người dùng có quyền kiểm soát trình duyệt/localStorage có thể sửa hoặc xóa dữ liệu; audit mock không phải kho bất biến.
- Khi `VITE_USE_MOCK=false`, UI gọi API HTTP. Backend thật hiện chưa có đầy đủ các API quản trị mở rộng được liệt kê ở phần dưới; các endpoint lọc, schema phản hồi, kiểm tra kênh và quyền truy cập cần được triển khai/đồng bộ ở backend trước khi dùng dữ liệu production.
- Không lưu bí mật kết nối, token thông báo hoặc credential server trong giao diện. Cấu hình nhạy cảm phải nằm ở backend.

### Hợp đồng dữ liệu Admin cần đồng bộ với backend

- `GET /users?search&role&status&page&limit`: danh sách có `email`, `device_count` và metadata phân trang; `PATCH /users/:id` cho phép cập nhật email/quyền/trạng thái. Backend phải kiểm tra định dạng và email trùng.
- `GET /devices?search&registered&status&type_id&place_id&page&limit`: mỗi mục cần thông tin chủ sở hữu, đường dẫn vị trí, tên mẫu/loại, trạng thái kết nối và `last_seen`; response cần danh sách filter `types`/`places`. `POST /devices` cấp thiết bị/mã đăng ký.
- `GET /admin/overview`: cần trả `users`, `devices`, `sensors`, `alertsToday`, `incidents`, `traffic`, `latencyHistory`, `incidentHistory`, cùng `server.deviceAvailabilityPercent`, `server.commandFailurePercent`, `server.avgLatencyMs` và số lệnh 24 giờ.
- `GET/PATCH /admin/settings`: ngoài timeout, cần nhận/trả `audit_retention_days`, `alert_rules[]` (metric, min/max, severity, channels) và metric sensor kèm range/unit để validate.
- `POST /admin/settings/test-alert` body `{ metric, channel }`: endpoint này phải kiểm tra quyền, gọi adapter thông báo thật, trả trạng thái gửi và ghi audit; UI mock hiện chỉ mô phỏng.
- `GET /admin/logs?user_id&device_id&level&from&to&search&page&limit`: trả log phân trang và filter options. Bảo vệ endpoint bằng authorization phía server, không dựa vào ẩn menu frontend.

### Audit và bảo mật production

- Audit log được append từ đăng nhập, thay đổi tài khoản/cấu hình, lệnh phần cứng, cấp mã và kiểm tra kênh; UI không cung cấp thao tác sửa/xóa log.
- Đây là tính chất của trải nghiệm mock, không đảm bảo chống sửa/xóa. Production nên ghi log ở backend với danh tính actor, timestamp UTC, action, đối tượng, kết quả và metadata đã được lọc bí mật; dùng lưu trữ append-only, quyền đọc riêng, retention job có audit và backup.
- Kiểm tra quyền ở mọi endpoint, phân biệt role admin/developer ở server, giới hạn tốc độ các thao tác nhạy cảm và ghi nhận thay đổi quyền/tài khoản. Không đưa credential hoặc dữ liệu nhạy cảm vào CSV/audit detail.

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
| `GET /admin/overview` | Chỉ số dashboard quản trị và tình trạng toàn hệ thống |
| `GET /admin/logs?user_id&device_id&level&from&to&search&page&limit` | Nhật ký audit có lọc và phân trang |
| `GET/PATCH /admin/settings` | Đọc/lưu chính sách cảnh báo toàn hệ thống |
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
