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
| `Unsupported directory name(s) for screenshots/metadata` | Tên thư mục locale không nằm trong danh sách của Apple (ví dụ `zh-CN`, `vi-VN`). Dùng `zh-Hans`, `vi`… theo [configuration.md](configuration.md) |
| `ios.locales lists xx but ios/metadata/xx does not exist` | Đã khai báo locale trong `release.yml` nhưng chưa tạo thư mục. Tạo `release/ios/metadata/xx/` và điền file, hoặc bỏ locale khỏi `locales` |
| `ios/metadata/xx is not listed in ios.locales` (cảnh báo) | Có thư mục nhưng chưa khai báo. Thư mục vẫn được đẩy lên store. Thêm vào `locales` hoặc xoá thư mục |
| `android/metadata/xx is not a Google Play language code` (cảnh báo) | Mã locale Android sai, thường do copy từ iOS (`ja`, `ko`, `zh-Hans`, `es-MX`). Đổi tên thư mục và `android.locales` theo gợi ý của `doctor` (`ja-JP`, `ko-KR`, `zh-CN`, `es-419`). Bảng mã: [configuration.md](configuration.md#gói-ngôn-ngữ-gợi-ý) |
| Ngôn ngữ nào đó không có "What's New" sau khi đẩy metadata | Thiếu `release_notes.txt` (hoặc file trống) trong thư mục locale đó. `appship doctor` sẽ cảnh báo |
| `The provided entity includes an attribute with a value that has already been used` | Tên app (`name.txt`) đã có người dùng trên App Store. Hãy đổi tên |
| create-app hoặc App Privacy hỏi 2FA mỗi lần | Bình thường. fastlane lưu session khoảng 30 ngày trong `~/.fastlane/spaceship` |
| `doctor`: `this is a development/ad-hoc profile` | Profile không phải loại App Store. Nhờ owner tạo profile Distribution → **App Store Connect**, xem [signing.md](signing.md) |
| `doctor`: `profile … expired` | Profile hết hạn. Owner gia hạn (Developer Portal → Profiles → Edit → Save), tải lại, thay file rồi chạy `appship signing import` |
| `doctor`: `No profile covers ios.bundle_id` | Profile tạo cho App ID khác. Cần profile đúng bundle id (App ID wildcard `com.x.*` cũng được) |
| `doctor`: `None of the certificates the profile allows … is installed` | Certificate chưa có trong keychain kèm private key. Chạy `appship signing import` (cần `.p12`), hoặc cài certificate tạo từ CSR của chính bạn |
| `doctor`: `profile belongs to team … but ios.team_id is …` | Profile của team khác. Dùng đúng profile hoặc sửa `ios.team_id` |
| `doctor`: `ios.build_command does not use $APPSHIP_EXPORT_OPTIONS` | Lệnh build không nhận cách ký trong `ios.signing`. Thêm `--export-options-plist="$APPSHIP_EXPORT_OPTIONS"` (Flutter) hoặc `--export_options` (gym) |
| `doctor`: `.ipa was signed with a profile that is not in ios.signing.profiles` | `.ipa` build cũ hoặc build theo cách khác. Build lại sau `appship signing import` |
| Build báo `No signing certificate "iOS Distribution" found` / `No profile for team … matching …` | Bước archive trong project Xcode vẫn để automatic signing hoặc chọn sai profile. `ExportOptions.plist` chỉ điều khiển bước export, xem [signing.md](signing.md) |
| `Cannot inspect the keychain on this OS` | Chỉ macOS kiểm tra được keychain. Bỏ qua nếu bạn build ở nơi khác |
| Xác thực API lỗi với key cá nhân (không có Issuer ID) | Đảm bảo `issuer_id` **để trống** chứ không phải `TODO` hay chuỗi khác. Kiểm tra key chưa bị thu hồi và role của bạn đủ quyền. Tính năng này chưa được thử với key cá nhân thật, hãy báo lại nếu gặp lỗi |
| Không thấy tab Individual Keys | Admin có thể đã tắt quyền tạo key cá nhân. Hỏi owner, hoặc tải `.ipa` bằng tay (trường hợp 4 trong [signing.md](signing.md)) |
| `Set APPSHIP_P12_PASSWORD` / `Set APPSHIP_KEYCHAIN_PASSWORD` | Chạy không tương tác: đặt biến môi trường. `.p12` không có mật khẩu thì đặt `APPSHIP_P12_PASSWORD=""` |
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
