# 📧 Hướng dẫn Thiết lập Email Notification

Hệ thống English Skills AI sử dụng **Resend** để gửi email và **Vercel Cron** để tự động nhắc nhở bài tập. Để tính năng này hoạt động, bạn cần thực hiện các bước sau:

## 1. Đăng ký Resend và Lấy API Key
1. Truy cập [Resend.com](https://resend.com) và tạo tài khoản.
2. Đi tới phần **API Keys** và tạo một key mới (ví dụ: `re_123...`).
3. (Tùy chọn) Để gửi email từ domain riêng, hãy verify domain trong mục **Domains**. Nếu không, bạn có thể dùng địa chỉ mặc định `onboarding@resend.dev` để test (chỉ gửi được cho email cá nhân bạn đã đăng ký).

## 2. Lấy Firebase Admin Service Account
1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Chọn dự án của bạn -> **Project Settings** -> **Service Accounts**.
3. Bấm **Generate new private key** để tải file JSON về.
4. Bạn sẽ cần các thông tin sau từ file JSON:
   - `project_id`
   - `client_email`
   - `private_key`

## 3. Cấu hình Environment Variables (Env Vars)
Thêm các biến sau vào file `.env` (nếu chạy local) hoặc **Vercel Dashboard** (Settings -> Environment Variables):

| Biến Env | Giá trị / Ví dụ |
| :--- | :--- |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` |
| `EMAIL_FROM` | `English Skills AI <noreply@yourdomain.com>` hoặc dùng mặc định `onboarding@resend.dev` |
| `FIREBASE_PROJECT_ID` | Lấy từ file JSON service account |
| `FIREBASE_CLIENT_EMAIL` | Lấy từ file JSON service account |
| `FIREBASE_PRIVATE_KEY` | Lấy toàn bộ chuỗi `"-----BEGIN PRIVATE KEY-----\n..."` (bao gồm cả dấu nháy kép) |
| `FIREBASE_DATABASE_ID` | `(default)` hoặc ID database cụ thể nếu có |
| `CRON_SECRET` | Một chuỗi ngẫu nhiên 32 ký tự (để bảo mật cron job) |
| `APP_BASE_URL` | Domain của app bạn (ví dụ: `https://my-app.vercel.app`) |

## 4. Cách Hoạt động
### 🚀 Thông báo Giao bài (Assignment)
- Gửi ngay lập tức khi giáo viên bấm nút **Giao bài**.
- Email chứa tên bài tập, yêu cầu điểm đạt, hạn chót và nút bấm dẫn trực tiếp tới bài học.
- Giáo viên nhận được thông báo: "Đã gửi email thành công cho X học sinh".

### ⏰ Nhắc nhở Tự động (Reminder Cron)
- Vercel Cron được cấu hình chạy **mỗi giờ một lần**.
- Hệ thống tìm các bài tập có deadline trong khoảng **3 đến 5 giờ tới**.
- Email nhắc nhở được gửi cho học sinh:
  - Chưa làm bài.
  - Đã làm nhưng điểm chưa đạt yêu cầu (ví dụ: đạt 7.5/10 trong khi yêu cầu là 8.0/10).
- Sau khi gửi xong, hệ thống đánh dấu `reminderSent: true` để không gửi lặp lại trong lần chạy sau.

## 5. Kiểm tra và Debug
- Kiểm tra log trên Vercel Dashboard (tab **Logs**) để xem quá trình gửi email.
- Nếu email không đến, hãy kiểm tra:
  - API Key của Resend có đúng không?
  - Email học sinh có hợp lệ không?
  - Email của bạn đã được verify trong Resend (nếu dùng free plan) chưa?
