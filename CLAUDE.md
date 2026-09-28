# appship-ai

CLI Node (`appship`) để release app lên App Store và Google Play, chạy trên nền fastlane. Người dùng viết tiếng Việt.

Trước khi thay đổi, đọc các file sau:

- `docs/design.md`: mục tiêu, giới hạn của store, các quyết định kiến trúc (không được phá các quyết định này nếu chưa hỏi)
- `docs/roadmap.md`: trạng thái hiện tại, việc tiếp theo, câu hỏi còn mở
- `docs/development.md`: cấu trúc code, cách thêm lane

Quy ước:

- Tài liệu trong `docs/` viết bằng tiếng Việt. Thông báo của CLI và comment trong code dùng tiếng Anh.
- `README.md` ở gốc viết tiếng Anh (trang npm/GitHub); `docs/README.vi.md` là bản tiếng Việt. Khi sửa một bản thì sửa cả bản còn lại.
- Mỗi khi thay đổi hành vi, cập nhật tài liệu liên quan, `docs/roadmap.md` và `CHANGELOG.md`.
- Tên option của fastlane phải đối chiếu với mã nguồn fastlane đã cài (`/opt/homebrew/Cellar/fastlane/*/libexec/gems/fastlane-*/`), không viết theo trí nhớ.
- Test: `npm test`. Các lệnh ghi lên store phải có `--dry-run` và hỏi xác nhận (hoặc `--yes`).
- Không bao giờ commit key (`*.p8`, `*.jks`, service account JSON).
