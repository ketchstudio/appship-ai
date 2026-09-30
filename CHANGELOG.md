# Changelog

## 0.1.0 — 2026-09-28 (chưa phát hành)

Bản đầu tiên.

- CLI `appship` gồm các lệnh: `init`, `doctor`, `credentials`, `build`, `upload`, `metadata`, `submit`, `promote`, `status`, `first-release`, `checklist`.
- Fastfile dùng chung cho iOS (TestFlight, deliver, produce, App Privacy) và Android (supply).
- Key lấy theo thứ tự: biến môi trường → `release.yml` → profile trong `~/.appship`.
- `questionnaire.yml` cho các câu hỏi của store, cùng `CHECKLIST.md` cho các bước phải làm tay.
- Tên package: `appship-ai`. Lệnh: `appship`, kèm alias `appship-ai`.
- Trang giới thiệu tĩnh trong `website/` (HTML, CSS, JS thuần, có animation nhẹ), kèm trang hướng dẫn tích hợp `website/docs.html`. Chỉ hướng dẫn cài qua npm. Chạy tại https://appship.ketchsoft.com; cập nhật bằng `scripts/deploy-website.sh`, config nginx ở `deploy/nginx/`.
- License MIT, bản quyền Ketchsoft. `package.json` có thêm `author` (Ketchsoft), `repository`, `homepage`, `bugs`. README, website và tài liệu ghi "powered by Ketchsoft", không còn tên hay email cá nhân.
- `doctor` cảnh báo khi một số locale iOS có `release_notes.txt` còn locale khác thì trống. Tài liệu mới về release notes nhiều ngôn ngữ (iOS và Android), danh sách locale iOS hợp lệ, và các lỗi thường gặp (`configuration.md`, `troubleshooting.md`, README).
- `release.yml` có thêm `ios.locales` và `android.locales` (tuỳ chọn) để khai báo ngôn ngữ. `doctor`, `metadata`, `submit` và `upload` đối chiếu danh sách với các thư mục locale (thiếu thư mục = lỗi, thư mục thừa = cảnh báo). Tên locale iOS sai (ví dụ `zh-CN`) bị báo lỗi sớm, trước khi fastlane từ chối. `init` ghi sẵn dòng `locales` dạng comment vào template.
- Skill `release-notes` (`skills/release-notes/SKILL.md`) cho Claude Code: sinh release notes nhiều ngôn ngữ vào `release_notes.txt` (iOS) và `changelogs/default.txt` (Android) từ `git log`. `appship init` copy skill vào `.claude/skills/` của dự án (không ghi đè nếu đã có). Skill không đẩy gì lên store.
- README tiếng Anh; bản tiếng Việt chuyển sang `docs/README.vi.md`.
- Ký iOS khi không phải chủ tài khoản: khối `ios.signing` (`style`, `method`, `certificate`, `profiles`) trong `release.yml`, lệnh `appship signing import` (cài profile, import `.p12` vào keychain, hỗ trợ `--keychain` riêng cho CI) và `appship signing export-options`. `build_command` nhận `$APPSHIP_EXPORT_OPTIONS`, `$APPSHIP_IOS_BUNDLE_ID`, `$APPSHIP_IOS_TEAM_ID`. Mật khẩu `.p12` chỉ qua `APPSHIP_P12_PASSWORD`.
- `doctor` có mục **iOS · signing**: profile đúng loại App Store, còn hạn (cảnh báo dưới 30 ngày), đúng team và bundle id, certificate có trong keychain, `.ipa` đã build được ký bằng profile nào.
- `issuer_id` không còn bắt buộc, để dùng API key cá nhân của người không phải Account Holder/Admin (chưa thử với key thật).
- Gói ngôn ngữ gợi ý (Tây Ban Nha, Bồ Đào Nha Brazil, Đức, Pháp, Nhật, Hàn): `appship init --locales preset|es,ja` tạo sẵn thư mục metadata và ghi `locales` đúng mã của từng store (iOS `ja`/`es-MX`, Play `ja-JP`/`es-419`); `init` tương tác cho chọn ngôn ngữ; `doctor` gợi ý khi chỉ có một ngôn ngữ và cảnh báo mã locale Android không hợp lệ kèm mã đúng; mã Play đối chiếu với `Supply::Languages` của fastlane 2.232.2. Skill `release-notes` có thêm hướng dẫn từng ngôn ngữ (xưng hô, biến thể vùng, dấu câu Nhật/Pháp, đếm ký tự) và bảng mã iOS/Android. Chi tiết ở `docs/configuration.md`, mục "Gói ngôn ngữ gợi ý".
- Website có 8 ngôn ngữ (English ở gốc; `vi`, `ja`, `fr`, `es`, `pt` = pt-BR, `de`, `ko` là thư mục con). Menu chọn ngôn ngữ dạng dropdown hiện ngôn ngữ đang xem, kèm `hreflang`; sinh bằng `scripts/website-langs.mjs`. Đã bỏ mọi link tới GitHub trên website.
- Sửa: khi `release.yml` có `credentials.profile`, giá trị mẫu của `init` (`TODO` hoặc đường dẫn `release/keys/...` chưa tồn tại) không còn che profile, nên làm theo hướng dẫn của `credentials add` (chỉ thêm dòng `profile:`) là chạy được. Thứ tự env > release.yml > profile giữ nguyên.
- Tài liệu mới `docs/signing.md`: 5 trường hợp (owner, có file + key, có file không key, không có key, chỉ có key), CI, danh sách `doctor` kiểm tra. Cập nhật `credentials.md`, `configuration.md`, `commands.md`, `ci.md`, `troubleshooting.md`, `design.md`, `development.md`.
