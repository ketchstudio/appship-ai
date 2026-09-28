# Phát triển và phát hành tool

## Kiến trúc

```
bin/appship.js          entry point
src/cli.js              định nghĩa lệnh (commander)
src/config.js           đọc và validate release.yml
src/credentials.js      resolve key: env → release.yml → profile; quản lý profile
src/metadata.js         template và validate metadata, kích thước ảnh
src/questionnaire.js    questionnaire → JSON cho fastlane, checklist cho phần làm tay
src/context.js          gom config và key thành JSON context cho lane
src/fastlane.js         chạy fastlane trong release/.appship/fastlane-run
src/commands/*.js       từng lệnh
fastlane/Fastfile       lane dùng chung; chỉ đọc context JSON, không tự parse YAML
templates/              release.yml, questionnaire.yml cho init
website/                trang giới thiệu tĩnh (HTML/CSS/JS, không cần build, không nằm trong gói npm)
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
- Repo: https://github.com/ketchstudio/auto-app-store-upload-plugin. `repository`, `homepage` và `bugs` trong `package.json` đều trỏ về đây.
- README tiếng Anh ở gốc repo (hiển thị trên npm và GitHub); bản tiếng Việt ở `docs/README.vi.md`.

**Cài từ git** (trước khi lên npm):

```bash
npm i -g git+https://github.com/ketchstudio/auto-app-store-upload-plugin.git#v0.1.0
```

**Publish lên npm (lần đầu):**

1. Chạy thật với store ít nhất một lần (xem mục "Chưa kiểm chứng" trong `roadmap.md`).
2. Tạo tài khoản trên npmjs.com và **bật 2FA** (Account → Two-Factor Authentication).
3. `npm login`
4. Kiểm tra tên còn trống: `npm view appship-ai` (lỗi 404 nghĩa là còn trống).
5. Xem trước nội dung package: `npm pack --dry-run`. Không được có key hay file `.env`.
6. `npm test && npm publish`

**Ra phiên bản mới:**

```bash
# cập nhật CHANGELOG.md trước
npm version patch      # hoặc minor / major, tự tạo commit và tag
git push --follow-tags
npm publish
```

**Homebrew tap (tuỳ chọn):** tạo repo `homebrew-tap` với formula phụ thuộc `node` và `fastlane`, trỏ tới tarball của release trên GitHub. Người dùng cài bằng `brew install ketchstudio/tap/appship`.
