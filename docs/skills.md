# Skill cho AI agent (Claude Code, Codex, Antigravity)

appship đi kèm 3 skill. Mỗi skill là một file hướng dẫn (`SKILL.md`) để một AI coding agent làm một việc soạn nội dung cho store. **appship không tự chạy skill và không gọi AI nào**: bạn cần một agent đọc skill và làm theo, trên máy có dự án. Ba agent dùng được:

| Agent | Thư mục skill trong dự án | Gọi skill |
|---|---|---|
| [Claude Code](https://claude.com/claude-code) (Anthropic) | `.claude/skills/` | `/store-screenshots`, hoặc nói thường |
| [Codex](https://developers.openai.com/codex) (OpenAI), CLI hoặc extension IDE | `.agents/skills/` | `$store-screenshots`, hoặc `/skills` để chọn |
| [Antigravity](https://antigravity.google) (Google) | `.agents/skills/` | nói trong khung agent, ví dụ "dùng skill store-screenshots" |

Cả ba dùng chung định dạng `SKILL.md` (front matter `name` và `description`), nên cùng một file chạy được ở cả ba. Codex và Antigravity đọc chung thư mục `.agents/skills/`, nên chỉ cần một bản cho hai agent này. (Đối chiếu tài liệu của OpenAI và Google Codelab ngày 2026-10-01. Phần này dễ lỗi thời vì các agent hay đổi.)

Skill **chỉ ghi file** trong `release/`, chạy `appship doctor` để tự kiểm tra, rồi trả lại cho bạn. Skill không bao giờ đẩy gì lên store: bạn đọc lại, rồi tự chạy `appship metadata`, `first-release` hoặc `submit`.

| Skill | Nhờ agent | Ghi vào |
|---|---|---|
| `release-notes` | "viết release notes cho bản này" | `release_notes.txt` (iOS), `changelogs/default.txt` (Android) |
| `store-screenshots` | "làm screenshots cho store" | `release/ios/screenshots/<locale>/`, `release/android/metadata/<locale>/images/` |
| `app-content` | "điền questionnaire cho store" | `release/questionnaire.yml`, `release/CHECKLIST.md` |

## Cài đặt và cập nhật: `appship skills`

`appship init` hỏi bạn dùng agent nào rồi cài skill vào đúng thư mục (mặc định Claude Code). Không tương tác thì dùng `--agents`:

```bash
appship init --agents claude              # .claude/skills/ (mặc định)
appship init --agents codex,antigravity   # .agents/skills/
appship init --agents all                 # cả hai thư mục
appship init --agents none                # không cài skill
```

Với dự án đã `init` từ trước, khi đổi agent, hoặc sau khi nâng cấp appship:

```bash
appship skills                              # trạng thái skill theo từng agent
appship skills add                          # cài skill còn thiếu vào các thư mục agent đã có (chưa có thì .claude/skills/)
appship skills add --agent codex            # cài cho Codex (.agents/skills/)
appship skills add store-screenshots        # chỉ một skill
appship skills add --force                  # thay bản trong dự án bằng bản của appship đang cài
```

- Trạng thái: `installed` (giống bản đi kèm), `installed, differs from this appship version` (bản cũ hơn hoặc bạn đã sửa), `not installed`.
- `skills add` không ghi đè skill đã có, để giữ chỗ bạn đã sửa. `--force` mới ghi đè (mất phần đã sửa).
- Lệnh tìm thư mục dự án giống các lệnh khác (thư mục cha có `release/release.yml`); dùng `--dir` để chỉ định.
- Nên commit `.claude/skills/` và/hoặc `.agents/skills/` để cả team dùng chung.
- Không dùng agent nào? Bỏ qua phần này. Các file trong `release/` vẫn sửa tay được như bình thường.

## Chạy skill với từng agent

Chuẩn bị chung:

1. Cài appship và fastlane, chạy `appship init` trong dự án (xem [getting-started.md](getting-started.md)). Skill gọi `appship doctor` và `appship checklist`, nên lệnh `appship` phải chạy được trong terminal của agent.
2. Cài agent theo trang chính thức của nó (link ở bảng trên) và đăng nhập bằng tài khoản của bạn. Chi phí AI tính theo gói của agent đó; appship không cần key AI nào.
3. Mở agent **ở thư mục gốc của dự án** (nơi có `release/` và `.claude/` hoặc `.agents/`). Agent chỉ thấy skill của dự án đang mở.
4. Agent sẽ xin phép trước khi chạy lệnh (`appship doctor`, `xcrun simctl`, `adb`, `npx playwright`…) hoặc ghi file. Đọc lệnh rồi cho phép. Đừng bật chế độ tự chấp nhận mọi lệnh nếu chưa quen.

**Claude Code**

```bash
cd my-app
claude
> /store-screenshots
```

Gõ `/` để xem danh sách skill. Cũng có thể nói thường ("làm screenshots cho store"), Claude tự chọn skill theo `description`. Skill mới cài thì mở phiên Claude Code mới để nó được nạp.

**Codex** (CLI `codex`, hoặc extension trong VS Code/Cursor)

```bash
cd my-app
codex
> $store-screenshots
```

Gõ `$` để chọn skill, hoặc `/skills` để xem danh sách. Codex quét `.agents/skills/` từ thư mục hiện tại lên tới gốc repo. Sandbox mặc định của Codex có thể chặn mạng và một số lệnh hệ thống; khi skill cần `npx playwright` (tải Chromium), `adb` hoặc `xcrun simctl`, Codex sẽ xin quyền chạy ngoài sandbox, hoặc dùng Google Chrome đã cài sẵn để render.

**Antigravity**

Mở thư mục dự án làm workspace, rồi nhắn trong khung agent, ví dụ: "Dùng skill store-screenshots để làm screenshots cho App Store và Google Play". Antigravity tự chọn skill theo `description`, nhắc tên skill thì chắc chắn hơn. Antigravity đọc `.agents/skills/` của workspace (và vẫn đọc `.agent/skills/` cũ).

**Skill dùng chung cho mọi dự án** (tuỳ chọn): copy thư mục skill vào thư mục skill cá nhân của agent (Claude Code: `~/.claude/skills/`; Codex: `~/.agents/skills/`; Antigravity: xem tài liệu của Antigravity). Không khuyến khích: bản cá nhân không được `appship skills` cập nhật.

## `store-screenshots`

Agent sẽ:

1. Đọc `release.yml`, các thư mục locale, và xem app có chạy trên iPad không (`TARGETED_DEVICE_FAMILY` chứa `2`; Flutter mặc định là có). Nếu có thì cần thêm bộ iPad 13".
2. Đề xuất 4–6 màn hình và tiêu đề ngắn cho từng ảnh, hỏi bạn chọn kiểu **plain** (chỉ ảnh màn hình) hay **captioned** (nền màu thương hiệu, tiêu đề ở trên, màn hình ở dưới).
3. Chụp ảnh thô vào `release/screenshots-src/raw/`: ưu tiên công cụ dự án đã có (`fastlane snapshot`/`screengrab`, `integration_test` của Flutter, ảnh bạn đưa). Nếu không có thì chụp từ iOS Simulator (`xcrun simctl io booted screenshot`, status bar 9:41) hoặc Android emulator (`adb exec-out screencap`, demo mode). Agent thường không tự bấm qua app được, nên sẽ nhờ bạn mở từng màn hình.
4. Dịch tiêu đề sang mọi locale (lưu ở `release/screenshots-src/captions.yml`).
5. Dàn ảnh bằng một template HTML và render đúng kích thước bằng headless browser (Playwright hoặc Chrome): iPhone 1320x2868, iPad 2064x2752, Play 1080x1920, feature graphic 1024x500, icon Play 512x512 từ icon 1024 của app.
6. Kiểm tra kích thước và kênh alpha bằng `sips`, đặt file theo thứ tự `01_…`, `02_…`, hỏi trước khi thay ảnh đã có, rồi chạy `appship doctor`.

Yêu cầu: macOS (dùng `sips`), Xcode cho iOS Simulator, Android SDK (`adb`) cho emulator, và Google Chrome hoặc Playwright để render.

Lưu ý: `appship metadata` thay **toàn bộ** screenshot trên App Store Connect của mọi locale được đẩy (`overwrite_screenshots: true`). Chỉ muốn đẩy chữ thì dùng `appship metadata --no-screenshots`.

Kích thước và luật ảnh mà `doctor` kiểm tra: xem [configuration.md](configuration.md) (phần Screenshots iOS và Metadata Android).

## `app-content`

Điền `release/questionnaire.yml` (xem [questionnaire.md](questionnaire.md)) dựa trên bằng chứng trong dự án:

- Dependency (`pubspec.lock`, `Podfile.lock`, `package.json`, `build.gradle`…): SDK analytics, crash, quảng cáo, đăng nhập, mua trong app.
- Quyền và khai báo: `Info.plist` (`NS*UsageDescription`, `NSUserTrackingUsageDescription`, `ITSAppUsesNonExemptEncryption`), `AndroidManifest.xml`, entitlements, `PrivacyInfo.xcprivacy`.
- Code: màn hình đăng nhập, chat, nội dung người dùng tạo, WebView mở URL tự do, dữ liệu gửi về backend.

Agent hỏi bạn những gì code không cho biết (liên hệ cho reviewer, tài khoản demo, chủ đề nội dung của game, nhóm tuổi, dữ liệu có chia sẻ cho bên thứ ba không), sửa giá trị trong file mà giữ nguyên comment, rồi đảm bảo hai store trả lời khớp nhau. Ví dụ: quảng cáo thì cả `ios.age_rating.advertising` và `android.contains_ads`; mỗi mục App Privacy của iOS có mục Data safety tương ứng trên Play. Cuối cùng agent chạy `appship doctor` và `appship checklist`, rồi đưa bảng câu trả lời kèm bằng chứng (file, dòng) để bạn duyệt.

Bạn là người chịu trách nhiệm với các khai báo này trước store. Skill không tự điền thông tin cá nhân (tên, số điện thoại, email, mật khẩu demo): các trường đó giữ `TODO` cho đến khi bạn cung cấp.

## Sửa hoặc thêm skill (cho người phát triển appship)

Skill nằm trong `skills/<tên>/SKILL.md` của repo, có front matter `name` (trùng tên thư mục) và `description` (agent dùng để biết khi nào gọi skill; Codex giới hạn tổng độ dài description của mọi skill khoảng 8000 ký tự, nên giữ ngắn gọn). Thêm thư mục mới là `init` và `appship skills add` tự nhận. Nội dung skill phải trung lập, không nhắc riêng một agent nào. Nhớ thêm câu gợi ý vào `SKILL_USAGE` trong `src/commands/skills.js` và cập nhật bảng ở đầu file này.
