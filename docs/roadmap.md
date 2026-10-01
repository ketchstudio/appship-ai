# Trạng thái và lộ trình

Cập nhật lần cuối: 2026-10-01

## Trạng thái hiện tại (v0.1.0)

**Đã xong**

- [x] CLI gồm các lệnh: `init`, `doctor`, `credentials add/list/remove`, `build`, `upload`, `metadata push/pull`, `submit`, `promote`, `status`, `first-release`, `checklist`
- [x] Fastfile dùng chung: 6 lane iOS (`create_app`, `privacy`, `upload`, `metadata`, `submit`, `status`) và 4 lane Android (`upload`, `metadata`, `promote`, `status`)
- [x] Quản lý key: biến môi trường, `release.yml`, profile
- [x] Chuyển `questionnaire.yml` thành age rating, App Privacy JSON, thông tin cho reviewer, submission info, và checklist cho Android
- [x] Tự nhận diện Flutter, React Native, Cocos, native
- [x] Kiểm tra bảo mật: gitignore, phát hiện key bị commit
- [x] `doctor` cảnh báo release notes iOS thiếu ở một số locale; tài liệu release notes nhiều ngôn ngữ
- [x] `ios.locales` / `android.locales` trong `release.yml`, kiểm tra tên locale iOS
- [x] Skill `release-notes` (Claude Code) sinh release notes đa ngôn ngữ, cài bởi `init`
- [x] Gói ngôn ngữ gợi ý (es, pt-BR, de, fr, ja, ko): `init --locales`, mã riêng cho iOS và Play, `doctor` cảnh báo mã Android sai, skill `release-notes` có hướng dẫn từng ngôn ngữ
- [x] Ký iOS khi không phải chủ tài khoản: `ios.signing`, `appship signing import|export-options`, `$APPSHIP_EXPORT_OPTIONS` cho `build_command`, `doctor` kiểm tra profile/certificate/`.ipa`; `issuer_id` tuỳ chọn cho API key cá nhân; hướng dẫn cho 5 trường hợp ở `docs/signing.md`
- [x] 29 test (`npm test`): unit (kể cả đọc `.mobileprovision` giả và certificate tạo bằng openssl) và luồng CLI end-to-end ở chế độ dry-run
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
- [ ] Ký iOS bằng file trên máy thật: `signing import` với `.p12` và profile thật (mới thử bằng file giả và `--dry-run`, chưa import vào keychain thật), build bằng `--export-options-plist` / gym `--export_options`, và cấu hình archive thủ công trong Xcode
- [ ] API key cá nhân (không Issuer ID) với `deliver`/`pilot` thật, cùng các role Developer / App Manager
- [ ] `signing import --keychain` trên runner CI macOS
- [ ] Skill `release-notes` chạy thật trong Claude Code (mới kiểm tra file được copy đúng chỗ, chưa thử sinh nội dung)
- [ ] Gói ngôn ngữ gợi ý với store thật: push metadata `es-419`, `ja-JP`, `ko-KR` lên Play và `es-MX`, `ja`, `ko` lên App Store Connect; chất lượng bản dịch của skill `release-notes` do người bản ngữ kiểm tra
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

- [x] Đã publish `appship-ai@0.1.0` lên npm (2026-10-01, tài khoản `jackty`) và gắn tag `v0.1.0`; các bước và lưu ý về 2FA/token ở `docs/development.md`. Publish diễn ra trước khi chạy thật với store, nên gói còn ở trạng thái thử nghiệm; cân nhắc `npm deprecate` hoặc dist-tag `beta` nếu phát hiện lỗi lớn khi chạy thật.
- [ ] Chuyển tài khoản/org npm sang tên Ketchsoft (hiện đứng tên cá nhân `jackty`), thu hồi các access token đã dùng để publish.
- Dịch các tài liệu chính (`getting-started`, `credentials`) sang tiếng Anh nếu có người dùng nước ngoài.
- Homebrew tap (tuỳ chọn).
- [x] Website 8 ngôn ngữ (en, vi, ja, fr, es, pt-BR, de, ko) với menu dropdown chọn ngôn ngữ; cách thêm ngôn ngữ ở `docs/development.md`. Bản dịch do máy dịch, chưa có người bản ngữ rà soát.
- [x] Trang giấy phép mã nguồn mở `license.html` (8 ngôn ngữ): tóm tắt MIT, toàn văn, giấy phép của fastlane và 4 dependency npm (đối chiếu `node_modules` và fastlane 2.232.2), nhãn hiệu Apple/Google. Link ở footer. Bản dịch chưa có người bản ngữ rà soát, và phần tóm tắt "In plain words" chưa qua luật sư.
- [x] SEO cho website: `canonical`, `hreflang` tuyệt đối, Open Graph, Twitter Card, JSON-LD, `robots`, `sitemap.xml`, `robots.txt`, ảnh `og.png`; title trang chủ có mô tả thay vì chỉ "appship". Chưa làm: đăng ký sitemap trong Google Search Console / Bing Webmaster, kiểm tra bằng công cụ Rich Results sau khi deploy.
- [x] Trang giới thiệu tĩnh trong `website/` (tiếng Anh), gồm trang chủ và hướng dẫn tích hợp (`docs.html`). Đã deploy tại https://appship.ketchsoft.com (cách cập nhật: `docs/development.md`). Khi sửa `docs/getting-started.md`, `credentials.md` hoặc `ci.md`, nhớ sửa cả `website/docs.html`.
- [ ] Repo công khai và liên kết với website: code và tài liệu đã sửa (URL `ketchstudio/appship-ai`, `homepage` = website, footer có link GitHub, README có link website). **Còn lại, cần quyền admin của repo:** đổi tên repo, chuyển sang Public, đặt ô Website trong Settings, rồi deploy website (chỉ sau khi repo đã public, nếu không link 404) và đổi `git remote`. Lịch sử git đã quét, không có key.
- Site tài liệu (VitePress) nếu có người dùng bên ngoài.
- Sinh tự động phần tham chiếu lệnh và config từ code.
- Ký iOS: tích hợp `fastlane match` (hiện chỉ hướng dẫn chạy trước `build_command`); tự sinh CSR cho người không phải owner.

## Câu hỏi còn mở

- Tool sẽ chạy chủ yếu ở máy local hay trên CI?
- Tool dùng cho dự án của riêng bạn hay cho nhiều khách hàng / nhiều tài khoản developer?
- Lệnh gõ hằng ngày nên giữ là `appship` hay đổi thành `appship-ai`?
