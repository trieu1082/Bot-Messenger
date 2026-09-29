# Chạy bot ở máy local / Termux

Bot này là một tiến trình Node.js chạy liên tục, không cần domain hay HTTPS, nên clone về máy (PC, VPS, hoặc Termux trên Android) rồi chạy là được. Server HTTP trong `utils/monitor.js` chỉ để xem trạng thái, mặc định `http://127.0.0.1:3000`.

## 1. Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install -y git nodejs-lts python clang make binutils libsqlite
termux-setup-storage      # tùy chọn, nếu cần copy cookie từ Download

git clone https://github.com/trieu1082/Bot-Messenger.git
cd Bot-Messenger
npm install               # sqlite3 sẽ build từ source, mất vài phút
```

Nếu `npm install` chết ở `sqlite3` (không có prebuilt cho Android):

```bash
npm install --build-from-source sqlite3
# hoặc dùng sqlite hệ thống cho nhanh:
npm install sqlite3 --build-from-source --sqlite=$PREFIX
```

## 2. PC / VPS Linux, macOS, Windows

```bash
git clone https://github.com/trieu1082/Bot-Messenger.git
cd Bot-Messenger
npm install
```

Yêu cầu Node.js >= 20.17. Linux cần `build-essential python3` nếu sqlite3 phải build từ source.

## 3. Nạp cookie Facebook

Cách đơn giản nhất khi chạy local: tạo file `cookie.txt` ở thư mục gốc repo, dán chuỗi cookie:

```
c_user=100000xxxxxxx; xs=xx%3Axxxxxxx%3A...; fr=...; datr=...
```

Hoặc dùng `appstate.json` (mảng JSON), hoặc biến môi trường `FB_COOKIE` / `FB_APPSTATE`.
Cả hai file này đã nằm trong `.gitignore`, không bao giờ commit.

Biến môi trường khác (tùy chọn) đặt trong `.env` hoặc export trước khi chạy:

```bash
export GROQ_API_KEY=...          # bật AI
export MONITOR_API_KEY=...       # bảo vệ /api/status, /api/logs
export MONITOR_CONSOLE_LOGS=true # in log ra terminal
export PORT=3000
```

## 4. Chạy

```bash
npm run check    # kiểm tra cú pháp + module
npm start        # khởi động bot
```

Kiểm tra sống:

```bash
curl http://127.0.0.1:3000/healthz
curl -H "x-api-key: $MONITOR_API_KEY" http://127.0.0.1:3000/api/status
```

## 5. Giữ bot chạy nền

Termux:

```bash
pkg install -y termux-services tmux
termux-wake-lock          # chống Android ngủ giết tiến trình
tmux new -s bot
npm start
# Ctrl+B rồi D để thoát ra, tmux attach -t bot để quay lại
```

Linux/VPS: dùng `pm2 start index.js --name bot` hoặc một systemd unit.

## 6. So với Render

| | Local/Termux | Render |
|---|---|---|
| IP | IP nhà mạng, ít bị Facebook checkpoint | IP datacenter, dễ bị khóa cookie |
| Dữ liệu | `includes/data.sqlite` và `utils/data/fbstate.json` lưu vĩnh viễn | mất khi redeploy nếu không gắn Disk |
| Uptime | phụ thuộc máy/điện/mạng, Android có thể kill app | free plan spin down sau 15 phút |
| Chi phí | 0 | free hoặc trả phí |

Chạy local/Termux thường ổn định hơn cho bot Messenger dùng cookie.
