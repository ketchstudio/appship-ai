# Trạng thái và lộ trình

Cập nhật lần cuối: 2026-09-28

## Trạng thái hiện tại (v0.1.0)

**Đã xong**

- [x] CLI gồm các lệnh: `init`, `doctor`, `credentials add/list/remove`, `build`, `upload`, `metadata push/pull`, `submit`, `promote`, `status`, `first-release`, `checklist`
- [x] Fastfile dùng chung: 6 lane iOS (`create_app`, `privacy`, `upload`, `metadata`, `submit`, `status`) và 4 lane Android (`upload`, `metadata`, `promote`, `status`)
- [x] Quản lý key: biến môi trường, `release.yml`, profile
- [x] Chuyển `questionnaire.yml` thành age rating, App Privacy JSON, thông tin cho reviewer, submission info, và checklist cho Android
- [x] Tự nhận diện Flutter, React Native, Cocos, native
- [x] Kiểm tra bảo mật: gitignore, phát hiện key bị commit
- [x] 8 test (`npm test`): unit và luồng CLI end-to-end ở chế độ dry-run
- [x] Tài liệu tiếng Việt và mẫu GitHub Actions
- [x] License MIT; `package.json` có `author`, `repository`, `homepage`, `bugs`
- [x] README tiếng Anh cho npm/GitHub (bản tiếng Việt ở `docs/README.vi.md`)

**Chưa kiểm chứng.** Mới test bằng key giả và dry-run, **chưa chạy thật với store**:

- [ ] `status` với key thật. Nên thử đầu tiên vì lệnh này chỉ đọc.
- [ ] `metadata pull` và `metadata push`
- [ ] `upload`: TestFlight và Google Play internal track
- [ ] `first-release --create-app` (Apple ID, 2FA)
- [ ] Upload App Privacy JSON
- [ ] `submit` iOS và promote Android
- [ ] Đường dẫn artifact mặc định cho Cocos và React Native
- [ ] Danh sách category App Privacy trong `docs/questionnaire.md` có còn khớp tên hiện hành của Apple không

## Giai đoạn tiếp theo

### Giai đoạn 1: Chạy thật trên 1–2 dự án

- Dùng Word Bank làm dự án thử: `init`, `doctor`, `status`, `metadata pull`, `upload` lên internal/TestFlight.
- Ghi mọi chỗ vướng vào `docs/troubleshooting.md`.
- Sửa lane nếu option của fastlane không hoạt động như mong đợi.

### Giai đoạn 2: Hoàn thiện first release

- Kiểm tra app đã tồn tại trên store chưa trước khi chạy `create_app`.
- Tự sinh Data Safety CSV cho Google Play. Play có API nhận CSV cho phần này; cần nghiên cứu thêm.
- Tự tăng version code / build number (tuỳ chọn).

### Giai đoạn 3: Vận hành

- `appship reviews`: đọc và trả lời review của user (cả hai store đều có API). Có thể dùng AI soạn nháp câu trả lời.
- Gửi thông báo Slack/Telegram khi upload, submit, hoặc khi trạng thái review thay đổi.
- `status --watch`: theo dõi đến khi app được duyệt.

### Giai đoạn 4: Phát hành tool

- Bật 2FA cho tài khoản npm rồi publish `appship-ai` (các bước ở `docs/development.md`). Việc này được hoãn lại cho đến khi đã chạy thật với store.
- Dịch các tài liệu chính (`getting-started`, `credentials`) sang tiếng Anh nếu có người dùng nước ngoài.
- Homebrew tap (tuỳ chọn).
- [x] Trang giới thiệu tĩnh trong `website/` (tiếng Anh), gồm trang chủ và hướng dẫn tích hợp (`docs.html`). Chưa deploy; có thể dùng GitHub Pages. Khi sửa `docs/getting-started.md`, `credentials.md` hoặc `ci.md`, nhớ sửa cả `website/docs.html`.
- Site tài liệu (VitePress) nếu có người dùng bên ngoài.
- Sinh tự động phần tham chiếu lệnh và config từ code.

## Câu hỏi còn mở

- Tool sẽ chạy chủ yếu ở máy local hay trên CI?
- Tool dùng cho dự án của riêng bạn hay cho nhiều khách hàng / nhiều tài khoản developer?
- Lệnh gõ hằng ngày nên giữ là `appship` hay đổi thành `appship-ai`?
