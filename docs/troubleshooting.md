# Xử lý lỗi thường gặp

Chạy `appship doctor` trước tiên. Để xem stack trace, đặt `APPSHIP_DEBUG=1`. Log chi tiết của fastlane nằm ngay trên dòng báo lỗi.

## Chung

| Lỗi | Cách xử lý |
|---|---|
| `No release/release.yml found` | Chạy `appship init` trong thư mục dự án |
| `fastlane not found` | `brew install fastlane` hoặc đặt `APPSHIP_FASTLANE="bundle exec fastlane"` |
| `pass --yes to confirm in non-interactive mode` | Trên CI, thêm `--yes` |
| `No ios artifact matches …` | Build trước (`appship build`) hoặc sửa `artifact` trong `release.yml` |

## iOS

| Lỗi | Nguyên nhân và cách xử lý |
|---|---|
| `Authentication credentials are missing or invalid` | Sai Key ID hoặc Issuer ID, hoặc key đã bị revoke |
| `Could not find app with bundle identifier` | App chưa được tạo. Chạy `appship first-release --create-app` hoặc tạo trên App Store Connect |
| `The bundle version must be higher than the previously uploaded version` | Tăng build number (Flutter: số sau dấu `+` trong `pubspec.yaml`) |
| `Export compliance is required to submit` | Điền `ios.export_compliance.uses_non_exempt_encryption` |
| Submit báo không có build | Build vẫn đang được Apple xử lý (5–30 phút). Chạy `appship status` rồi thử lại |
| `whatsNew` / release notes bị từ chối ở version 1.0 | Để trống `release_notes.txt` cho version đầu tiên |
| `The provided entity includes an attribute with a value that has already been used` | Tên app (`name.txt`) đã có người dùng trên App Store. Hãy đổi tên |
| create-app hoặc App Privacy hỏi 2FA mỗi lần | Bình thường. fastlane lưu session khoảng 30 ngày trong `~/.fastlane/spaceship` |
| Screenshot bị từ chối vì sai kích thước | Xem kích thước hợp lệ trong [configuration.md](configuration.md) |

## Android

| Lỗi | Nguyên nhân và cách xử lý |
|---|---|
| `Package not found: com.x.y` | App chưa được tạo trên Play Console, hoặc chưa upload AAB đầu tiên bằng tay |
| `The caller does not have permission` | Service account chưa được mời vào Play Console hoặc thiếu quyền. Quyền mới cấp có thể mất vài giờ mới có hiệu lực |
| `Only releases with status draft may be created on draft app` | App chưa publish lần nào. Đặt `release_status: draft` |
| `APK specifies a version code that has already been used` | Tăng `versionCode` |
| `Changes cannot be sent for review automatically` | Play yêu cầu gửi review thủ công cho thay đổi này. Vào Publishing overview và bấm "Send for review" |
| Không được phép lên production | Tài khoản cá nhân mới cần closed test với 12 tester trong 14 ngày liên tục rồi mới được xin quyền production |
| `Precondition check failed` khi đẩy metadata | Thiếu thông tin bắt buộc trong App content. Hoàn thành mục đó theo CHECKLIST.md |
