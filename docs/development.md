# Phát triển và phát hành tool

## Kiến trúc

```
bin/appship.js          entry point
src/cli.js              định nghĩa lệnh (commander)
src/config.js           đọc và validate release.yml
src/credentials.js      resolve key: env → release.yml → profile; quản lý profile
src/locales.js          gói ngôn ngữ gợi ý (mã iOS và Play), danh sách mã Play, gợi ý đổi mã iOS sang Play
src/metadata.js         template và validate metadata, kích thước ảnh
src/signing.js          ký iOS từ file: đọc .mobileprovision, kiểm tra profile/certificate, ExportOptions.plist, import vào keychain
src/questionnaire.js    questionnaire → JSON cho fastlane, checklist cho phần làm tay
src/skills.js           liệt kê skill đi kèm, so sánh với bản trong dự án, copy vào .claude/skills/
src/context.js          gom config và key thành JSON context cho lane
src/fastlane.js         chạy fastlane trong release/.appship/fastlane-run
src/commands/*.js       từng lệnh (signing.js: `appship signing import|export-options`; skills.js: `appship skills list|add`)
fastlane/Fastfile       lane dùng chung; chỉ đọc context JSON, không tự parse YAML
templates/              release.yml, questionnaire.yml cho init
skills/                 skill đi kèm cho AI agent (release-notes, store-screenshots, app-content); init và `appship skills add` copy vào .claude/skills/ (Claude Code) hoặc .agents/skills/ (Codex, Antigravity) của dự án (xem skills.md)
website/                trang giới thiệu tĩnh (HTML/CSS/JS, không cần build, không nằm trong gói npm)
scripts/deploy-website.sh   đẩy website/ lên server
deploy/nginx/           server block nginx của trang giới thiệu
```

Luồng một lệnh: CLI đọc config, resolve key, validate, rồi ghi `context.json` với quyền 600. Tiếp theo nó copy `Fastfile` vào `release/.appship/fastlane-run/` và chạy `fastlane <platform> <lane>`. Chạy xong thì xoá `context.json`.

Dự án không chứa Fastfile riêng, nên khi sửa `fastlane/Fastfile` trong repo này, mọi dự án nhận thay đổi ở lần chạy tiếp theo.

## Chạy local

```bash
npm install
npm link            # lệnh appship trỏ vào source này
npm test
```

Thử trên dự án thật mà không đẩy gì lên store:

```bash
appship upload --dry-run
appship submit --dry-run
```

## Thêm một lane mới

1. Thêm lane vào `fastlane/Fastfile`. Đọc input từ `ios_ctx` hoặc `android_ctx`.
2. Nếu lane cần input mới, thêm trường vào `iosContext`/`androidContext` trong `src/context.js`.
3. Thêm lệnh hoặc tuỳ chọn trong `src/cli.js` và `src/commands/`.
4. Viết test (`test/`) và cập nhật `docs/commands.md`.

## Phát hành

Thông tin package:

- Tên: `appship-ai` (tên `appship` đã có người dùng). Cài ra lệnh `appship`, kèm alias `appship-ai` để `npx appship-ai …` chạy được.
- License: MIT (`LICENSE`), bản quyền Ketchsoft.
- Repo (public): https://github.com/ketchstudio/appship-ai. `repository` và `bugs` trong `package.json` trỏ về repo; `homepage` trỏ về website https://appship.ketchsoft.com. Trong Settings của repo, ô Website cũng đặt là URL này, và footer của website có link GitHub nên hai bên trỏ lẫn nhau.
- README tiếng Anh ở gốc repo (hiển thị trên npm và GitHub); bản tiếng Việt ở `docs/README.vi.md`.

**Cài từ git** (một phiên bản cụ thể theo tag):

```bash
npm i -g git+https://github.com/ketchstudio/appship-ai.git#v0.1.0
```

**Đã publish:** `appship-ai@0.1.0` lên npm ngày 2026-10-01, tài khoản npm `jackty` (tài khoản cá nhân), tag git `v0.1.0`. Publish chưa kèm bước "chạy thật với store" (xem `roadmap.md`).

**Publish lên npm (các bước đã dùng):**

1. Tài khoản npmjs.com có **bật 2FA** (Account → Two-Factor Authentication).
2. `npm login`, rồi `npm whoami` để kiểm tra.
3. Xem trước nội dung package: `npm pack --dry-run`. Không được có key hay file `.env`.
4. `npm test && npm publish --access public`.

Khi 2FA chỉ dùng passkey (không có authenticator app), CLI không lấy được OTP: `npm publish` báo `EOTP` và không đưa link xác nhận qua trình duyệt. Hai cách: thêm authenticator app làm 2FA rồi `npm publish --otp=<mã>`, hoặc dùng Granular Access Token (Read and write, **All packages** vì gói mới chưa tồn tại, **bật Bypass two-factor authentication**), đặt bằng `npm config set //registry.npmjs.org/:_authToken <token>`. Thiếu Read and write/All packages thì npm trả 403; thiếu Bypass 2FA thì vẫn trả `EOTP`. Token không được dán vào chat hay commit; publish xong thì thu hồi token và `npm config delete //registry.npmjs.org/:_authToken`. Sau lần publish đầu, `npm view` có thể trả 404 vài phút vì registry cache kết quả "không tìm thấy"; thêm `--prefer-online` để kiểm tra.

**Ra phiên bản mới:**

```bash
# cập nhật CHANGELOG.md trước
npm version patch      # hoặc minor / major, tự tạo commit và tag
git push --follow-tags
npm publish
```

## Trang giới thiệu (appship.ketchsoft.com)

Trang tĩnh trong `website/` chạy ở https://appship.ketchsoft.com, trên droplet DigitalOcean của Ketchsoft (dùng chung với các site khác của Ketchsoft).

| Thành phần | Vị trí |
|---|---|
| File web | `/var/www/html/appship` (ngang hàng `ketchsoft-lp`) |
| Config nginx | `/etc/nginx/sites-available/appship.ketchsoft.com`, symlink trong `sites-enabled`. Bản trong repo: `deploy/nginx/appship.ketchsoft.com.conf` (trước khi certbot thêm phần SSL) |
| HTTPS | Let's Encrypt qua `certbot --nginx`, tự gia hạn bằng timer của certbot |
| DNS | Bản ghi A `appship` → IP droplet, trong DigitalOcean → Networking → Domains → `ketchsoft.com` |
| SSH | `root`, key `~/.ssh/id_ed25519_ketchsoft_deploy` (public key nằm trong `/root/.ssh/authorized_keys`) |

**Cập nhật trang** sau khi sửa file trong `website/`:

```bash
scripts/deploy-website.sh --dry-run   # xem file nào sẽ thay đổi
scripts/deploy-website.sh
```

Script chỉ đồng bộ thư mục `/var/www/html/appship`, không đụng vào nginx. Có thể đổi host, key hoặc thư mục qua `APPSHIP_WEB_HOST`, `APPSHIP_WEB_KEY`, `APPSHIP_WEB_DIR`. CSS/JS được cache 1 giờ, nên trình duyệt có thể cần tải lại cứng để thấy thay đổi ngay.

**Nhiều ngôn ngữ:** bản tiếng Anh nằm ở gốc `website/`, mỗi ngôn ngữ khác là một thư mục con có đủ `index.html`, `docs.html` và `license.html` (`vi`, `ja`, `fr`, `es`, `pt` = pt-BR, `de`, `ko`), dùng chung `style.css` và `main.js`. Menu chọn ngôn ngữ là `<details class="lang-menu">` (chạy được khi tắt JS), hiện ngôn ngữ đang xem, cùng các thẻ `hreflang` trong `<head>`. Cả hai nằm giữa cặp comment `langs:head` / `langs:nav` và được sinh bởi `scripts/website-langs.mjs`. Đừng sửa tay hai khối này.

**Trang giấy phép** (`license.html`): tóm tắt MIT, toàn văn giấy phép, giấy phép của phần mềm bên thứ ba và lưu ý nhãn hiệu; link ở footer mọi trang. Toàn văn MIT luôn giữ tiếng Anh ở mọi ngôn ngữ và phải khớp với file `LICENSE` ở gốc repo. Khi đổi `LICENSE` hoặc thêm/bớt dependency trong `package.json`, sửa bảng "Third-party software" và văn bản ở cả 8 bản.

**SEO:** khối `langs:head` còn chứa `canonical`, `hreflang` tuyệt đối (kèm `x-default`), `robots`, `theme-color`, Open Graph (kèm `og:locale` và `og:locale:alternate`), Twitter Card và JSON-LD (`SoftwareApplication` cho trang chủ, `TechArticle` cho docs). Cùng script đó sinh `website/sitemap.xml` (có `xhtml:link` các ngôn ngữ) và `website/robots.txt`. Dữ liệu lấy từ: `<meta name="description">` và `<title>` của từng trang (trang docs); `<title>` trang chủ lấy từ trường `title` trong `LANGS`. Muốn đổi title hay mô tả thì sửa ở đó (hoặc trong trang), rồi chạy lại script. Ảnh chia sẻ `website/og.png` (1200×630) là ảnh tĩnh, sinh bằng cách chụp một trang HTML; đổi thương hiệu thì chụp lại. Domain nằm ở hằng `BASE` trong script.

- Sửa nội dung: sửa bản tiếng Anh trước, rồi sửa các bản dịch tương ứng. Các bản dịch phải giữ nguyên class, id, anchor `#...` và SVG; chỉ đổi chữ. Nhãn nút Copy của từng ngôn ngữ nằm trong `LABELS` ở `website/main.js`.
- Thêm ngôn ngữ: thêm dòng vào `LANGS` trong `scripts/website-langs.mjs` (thư mục, mã `lang` HTML, mã `og:locale`, tên hiển thị, title trang chủ), thêm nhãn vào `LABELS` trong `main.js`, tạo `index.html`, `docs.html` và `license.html` trong thư mục mới (trong bản dịch: `../style.css`, `../main.js`, chép nguyên hai khối marker), rồi chạy `node scripts/website-langs.mjs` để cập nhật menu, `hreflang`, thẻ SEO và sitemap của mọi trang.
- Footer của mọi trang có link GitHub (`https://github.com/ketchstudio/appship-ai`, mỗi trang đúng một link). Nếu đổi tên repo thì sửa ở 24 trang; kiểm tra bằng `grep -rc 'ketchstudio/appship-ai' website/`. Chỉ deploy website sau khi repo đã public, nếu không link sẽ 404.

**Khi sửa config nginx:** server đang chạy nhiều site khác. Chỉ sửa file của appship, luôn chạy `nginx -t` trước và chỉ `systemctl reload nginx` khi test đạt.

**Homebrew tap (tuỳ chọn):** tạo repo `homebrew-tap` với formula phụ thuộc `node` và `fastlane`, trỏ tới tarball của release trên GitHub. Người dùng cài bằng `brew install ketchstudio/tap/appship`.
