# Changelog

## 0.2.0 — 2026-10-01

- Skill mới, được `init` cài cùng `release-notes`:
  - `store-screenshots`: lên kế hoạch ảnh, chụp từ iOS Simulator (`simctl`) hoặc Android emulator (`adb`, demo mode), dịch tiêu đề cho từng locale, dàn ảnh bằng template HTML và render đúng kích thước bằng headless browser (iPhone 1320x2868, iPad 2064x2752 khi app chạy trên iPad, Play 1080x1920, feature graphic 1024x500, icon 512x512). Kích thước và luật đặt tên đối chiếu với `Deliver::AppScreenshot`, `Deliver::Loader` và `Supply` của fastlane 2.232.2.
  - `app-content`: điền `release/questionnaire.yml` (age rating, App Privacy, export compliance, content rights, reviewer, Data safety, content rating, target audience, ads, app access) từ dependency, `Info.plist`, `AndroidManifest.xml` và code; hỏi người dùng phần code không cho biết; giữ câu trả lời iOS và Android khớp nhau; chạy `doctor` và `checklist`.
- Skill dùng được với 3 AI agent: Claude Code (`.claude/skills/`), Codex và Antigravity (cùng đọc `.agents/skills/`). Nội dung skill trung lập, không nhắc riêng agent nào. appship không gọi AI và không cần key AI.
- `appship init --agents claude|codex|antigravity|all|none` (khi chạy tương tác thì hỏi bằng checkbox; mặc định Claude Code như trước).
- Lệnh `appship skills` (`list`, mặc định, trạng thái theo từng agent) và `appship skills add [name…] [--agent …] [--force] [--dir]`: cài skill cho dự án đã `init` trước khi có skill hoặc khi đổi agent; không có `--agent` thì cài vào các thư mục agent đã có (chưa có thì `.claude/skills/`); không ghi đè bản đã sửa trừ khi có `--force`. Thay cho hướng dẫn `cp -r` bằng tay.
- Tài liệu `docs/skills.md`: cách cài và chạy skill với Claude Code, Codex, Antigravity. `design.md` thêm quyết định "soạn nội dung bằng AI là skill, không phải tính năng của CLI".
- `doctor` kiểm tra thêm ảnh: Play `phoneScreenshots` tối đa 8 ảnh, mỗi cạnh 320–3840 px và cạnh dài ≤ 2 lần cạnh ngắn (ảnh chụp thô 1080x2400 giờ bị báo lỗi thay vì bị Play từ chối lúc push); cảnh báo PNG có kênh alpha (screenshot iOS, `phoneScreenshots`, `featureGraphic`) và thư mục iOS trộn file `*_framed` với file thường.
- Sửa tài liệu: category App Privacy "Khác" là `OTHER_DATA` (không phải `OTHER_DATA_TYPES`), theo `Spaceship::ConnectAPI::AppDataUsageCategory`.
- Tài liệu mới `docs/skills.md`; cập nhật `commands.md`, `configuration.md`, `getting-started.md`, `questionnaire.md`, `development.md`, README (EN, VI) và trang docs của website (8 ngôn ngữ). Trang chủ website (8 ngôn ngữ) có thêm mục tính năng "Your AI agent drafts the store content".

## 0.1.0 — 2026-10-01

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
- Website có 8 ngôn ngữ (English ở gốc; `vi`, `ja`, `fr`, `es`, `pt` = pt-BR, `de`, `ko` là thư mục con). Menu chọn ngôn ngữ dạng dropdown hiện ngôn ngữ đang xem, kèm `hreflang`; sinh bằng `scripts/website-langs.mjs`.
- Sửa: khi `release.yml` có `credentials.profile`, giá trị mẫu của `init` (`TODO` hoặc đường dẫn `release/keys/...` chưa tồn tại) không còn che profile, nên làm theo hướng dẫn của `credentials add` (chỉ thêm dòng `profile:`) là chạy được. Thứ tự env > release.yml > profile giữ nguyên.
- Website có trang giấy phép mã nguồn mở `license.html` ở cả 8 ngôn ngữ: tóm tắt MIT bằng lời thường, toàn văn giấy phép (luôn tiếng Anh, khớp `LICENSE`), giấy phép của fastlane và các dependency npm (commander, @inquirer/prompts: MIT; picocolors, yaml: ISC), lưu ý nhãn hiệu Apple/Google. Link "License" ở footer mọi trang; trang có trong `sitemap.xml` và JSON-LD `WebPage`.
- SEO cho website: mỗi trang có `canonical`, `hreflang` tuyệt đối kèm `x-default`, `robots`, `theme-color`, Open Graph, Twitter Card (`summary_large_image`) và JSON-LD (`SoftwareApplication` / `TechArticle`); thêm `sitemap.xml` (kèm liên kết các ngôn ngữ), `robots.txt` và ảnh chia sẻ `og.png` 1200×630. Title trang chủ của cả 8 ngôn ngữ giờ có mô tả thay vì chỉ "appship". Tất cả do `scripts/website-langs.mjs` sinh.
- Repo công khai và liên kết với website: tên repo đổi thành `ketchstudio/appship-ai`; `package.json` có `repository` và `bugs` trỏ về repo, `homepage` trỏ về https://appship.ketchsoft.com; footer của 24 trang website có link GitHub; README (EN và VI) có link website và URL clone mới. Đã quét lịch sử git trước khi public, không có key hay token (chỉ có fixture `BEGIN PRIVATE KEY` giả trong test).
- Đã publish lên npm: `npm i -g appship-ai` và `npx appship-ai` chạy được; README (EN và VI) đưa lệnh npm lên đầu và bỏ ghi chú "chưa có trên npm"; tag git `v0.1.0`. Hướng dẫn publish (kèm xử lý 2FA bằng passkey và access token) ở `docs/development.md`.
- Tài liệu mới `docs/signing.md`: 5 trường hợp (owner, có file + key, có file không key, không có key, chỉ có key), CI, danh sách `doctor` kiểm tra. Cập nhật `credentials.md`, `configuration.md`, `commands.md`, `ci.md`, `troubleshooting.md`, `design.md`, `development.md`.
