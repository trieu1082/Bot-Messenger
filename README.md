# Bot-Messenger (Mirai Bot V3 updated)

Bot Facebook Messenger chạy trên Node.js, được nhập từ [DongDev-VN/Mirai-Bot-V3](https://github.com/DongDev-VN/Mirai-Bot-V3) và cập nhật để dễ cài đặt, an toàn hơn và tương thích với FCA hiện tại.

## Các cập nhật chính

- Đồng bộ mã nguồn Mirai Bot V3 tại commit `b1aeb823`.
- Nâng `@dongdev/fca-unofficial` lên **4.0.3**.
- Hỗ trợ Node.js **20.17+** và có `package-lock.json`.
- Sửa vòng lặp restart, MQTT reconnect, loader module, quyền lệnh, inbox và xử lý lỗi bất đồng bộ.
- Sửa khởi tạo/đồng bộ SQLite, controller và các event join/leave.
- Không còn ID admin, box hay dữ liệu người dùng mẫu từ source gốc.
- Cookie, appState, SQLite và dữ liệu runtime đều bị loại khỏi Git.
- Các lệnh nguy hiểm/hỏng được tắt mặc định: `anti`, `autodown`, `note`, `run`, `shell`.
- Có kiểm tra source và test tự động bằng `npm run check` / `npm test`.

> **Cảnh báo:** Đây là API Facebook không chính thức, hoạt động bằng phiên đăng nhập của tài khoản người dùng. Việc sử dụng có thể vi phạm điều khoản Meta và có thể khiến tài khoản bị checkpoint hoặc khóa. Chỉ dùng tài khoản phụ và tự chịu rủi ro.

## Cài đặt

### 1. Yêu cầu

- Node.js 20.17 trở lên (khuyến nghị Node 20 LTS).
- Git và Python/build tools nếu hệ điều hành phải biên dịch `sqlite3`.
- Một tài khoản Facebook phụ dành riêng cho bot.

### 2. Tải và cài package

```bash
git clone https://github.com/trieu1082/Bot-Messenger.git
cd Bot-Messenger
npm install
```

### 3. Cấu hình bot

Mở `config.json` và sửa tối thiểu:

```json
{
  "BOTNAME": "Tên bot của bạn",
  "PREFIX": "!",
  "ADMINBOT": ["FACEBOOK_ID_CUA_BAN"],
  "NDH": []
}
```

Phân quyền:

- `0`: thành viên.
- `1`: quản trị viên nhóm.
- `3`: ID trong `ADMINBOT` hoặc `NDH`, đều là quyền cao nhất. Không bật lại các lệnh thực thi mã nếu không thật sự cần.

`approvalMode` mặc định là `false`. Nếu bật thành `true`, hãy đặt `BOXADMIN` thành ID nhóm nhận yêu cầu duyệt; người dùng gửi `duyetbox`, sau đó admin dùng lệnh `duyet`.

### 4. Thêm phiên đăng nhập

**Không đăng cookie lên Git hoặc gửi cho người khác.** Chọn một cách:

- Tạo `cookie.txt` trong thư mục dự án và dán chuỗi cookie Facebook vào; hoặc
- Tạo `appstate.json` chứa mảng appState; hoặc
- Khi deploy, dùng biến môi trường `FB_COOKIE` / `FB_APPSTATE` (xem `.env.example`).

Các file bí mật đã có trong `.gitignore`.

### 5. Cấu hình AI Groq

Không đặt API key trong `config.json`, source hoặc tin nhắn commit. Tạo secret `GROQ_API_KEY` trong Replit hoặc biến môi trường trên Render. Mặc định AI dùng `llama-3.3-70b-versatile` và endpoint OpenAI-compatible của Groq.

AI chỉ trả lời khi thành viên gửi `message_reply` trỏ tới chính tin nhắn của bot trong group. Tin nhắn lệnh có prefix sẽ được bỏ qua. Danh sách thành viên lấy từ `getThreadInfo` và được đưa vào context với giới hạn để tránh request quá lớn. Tắt AI bằng `AI.enabled=false` trong `config.json`.

### 6. API theo dõi HTTPS

Ứng dụng mở HTTP nội bộ trên `0.0.0.0:${PORT}`. Replit và Render terminate TLS ở reverse proxy, vì vậy URL public của service là HTTPS mà không cần nhúng certificate vào source.

- `GET /healthz`: health check công khai cho Replit/Render.
- `GET /api/status`: trạng thái bot, database, MQTT, AI, API, số event, số lỗi và runtime.
- `GET /api/logs?limit=200&level=all`: log JSON hiện tại.
- `DELETE /api/logs`: xóa log thủ công.

Các endpoint `/api/*` yêu cầu `x-api-key: <MONITOR_API_KEY>` hoặc `Authorization: Bearer <MONITOR_API_KEY>`. Log chỉ nằm trong memory, mặc định tự xóa bản ghi quá 5 phút mỗi 5 phút; chỉnh bằng `LOG_TTL_MS` và `LOG_CLEANUP_INTERVAL_MS`. Mặc định không ghi log ra console Replit; đặt `MONITOR_CONSOLE_LOGS=true` nếu cần bật tạm thời.

Ví dụ kiểm tra:

```bash
curl -H "x-api-key: $MONITOR_API_KEY" https://YOUR-REPLIT-OR-RENDER-DOMAIN/api/status
curl -H "x-api-key: $MONITOR_API_KEY" https://YOUR-REPLIT-OR-RENDER-DOMAIN/api/logs
```

### 7. Kiểm tra và chạy

```bash
npm run check
npm test
npm start
```

Bot sẽ tự lưu phiên mới tại `utils/data/fbstate.json` và dữ liệu SQLite tại `includes/data.sqlite`; cả hai đều không được commit.

#### Replit

Dùng Node.js 20+, chạy `npm install` rồi `npm start`. Thêm `FB_COOKIE` hoặc `FB_APPSTATE`, `GROQ_API_KEY` và `MONITOR_API_KEY` vào Secrets. Không dùng `localhost` từ trình duyệt; gọi URL HTTPS public của Replit.

#### Render Web Service

Build command: `npm install`. Start command: `npm start`. Khai báo `PORT` do Render cấp cùng các biến `FB_*`, `GROQ_API_KEY` và `MONITOR_API_KEY`. Dịch vụ phải là Web Service để Render chuyển tiếp health check và HTTPS.

## Lệnh và module

Các module nằm tại:

- `modules/commands`: lệnh chat.
- `modules/events`: sự kiện nhóm.

Danh sách module tắt nằm trong `config.json` → `commandDisabled`. Không nên bật `run.js`, `shell.js` hoặc `note.js` trên bot có người điều hành không đáng tin cậy vì các module này có khả năng thực thi/ghi mã trên máy chủ.

## Bảo mật

- Không dùng email/mật khẩu Facebook trong source.
- Không commit `cookie.txt`, `appstate.json`, `fbstate.json` hay database.
- `npm audit --omit=dev` hiện không báo lỗ hổng đã biết trong dependency tree đã khóa.
- `fca-config.json` tắt tự cập nhật package và remote control; cập nhật dependency phải được review qua Git.

## Ghi công

Source ban đầu thuộc dự án Mirai Bot của CatalizCS/SpermLord và bản Mirai Bot V3 Unofficial do DongDev tiếp tục phát triển. Repository này giữ cấu trúc/module gốc, đồng thời bổ sung các bản sửa tương thích và an toàn vận hành.
