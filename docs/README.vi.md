# appship-ai (tiếng Việt)

[English](../README.md) · **Tiếng Việt**

Tự động release app **Android (Google Play)** và **iOS (App Store)** từ một file config, chạy trên nền [fastlane](https://fastlane.tools).

Mỗi dự án chỉ cần thư mục `release/` (config, metadata, câu trả lời cho store). Toàn bộ logic nằm trong tool, nên khi cập nhật tool thì mọi dự án đều được cập nhật.

```
appship init            # một lần mỗi dự án
appship doctor          # kiểm tra trước khi release
appship first-release   # lần đầu lên store
appship upload --build  # build + đẩy lên TestFlight / Google Play track
appship submit          # gửi review (iOS) / promote lên production (Android)
```

## Cài đặt

Yêu cầu: macOS (để build/upload iOS), Node 22+, fastlane.

```bash
brew install fastlane

# Từ npm
npm i -g appship-ai            # cung cấp lệnh appship (và alias appship-ai)
npx appship-ai doctor          # chạy không cần cài

# Cài từ git
npm i -g git+https://github.com/ketchstudio/auto-app-store-upload-plugin.git

# Khi đang phát triển tool
git clone https://github.com/ketchstudio/auto-app-store-upload-plugin.git
cd auto-app-store-upload-plugin && npm install && npm link
```

## Bắt đầu nhanh

```bash
# 1. Khai báo key store một lần cho mỗi tài khoản developer
appship credentials add my-company

# 2. Gắn vào dự án
cd ~/Projects/my-app
appship init                     # tự nhận Flutter / React Native / Cocos / native, bundle id, package name

# 3. Điền release/questionnaire.yml và release/*/metadata, thêm screenshots
appship doctor                   # sửa đến khi không còn lỗi đỏ

# 4. Lần đầu
appship first-release --create-app
#   → làm theo release/CHECKLIST.md cho các bước store không có API

# 5. Mỗi lần ra bản mới
appship upload --build
appship submit
```

Chi tiết: [getting-started.md](getting-started.md)

## Tính năng

| Chức năng | iOS | Android |
|---|---|---|
| Tạo app lần đầu | `first-release --create-app` (cần Apple ID) | Checklist, vì Google Play không có API |
| Upload build | TestFlight | internal / alpha / beta / production, staged rollout |
| Metadata và screenshots | push / pull | push / pull |
| Câu hỏi của store | Age rating, export compliance, content rights, review info, App Privacy | Checklist có sẵn câu trả lời (content rating, data safety, target audience, ads…) |
| Submit | Gửi App Review | Promote lên production |
| Trạng thái | Live / in review / editable, TestFlight build | Version code theo từng track |
| Kiểm tra trước | `doctor`: key, key lỡ commit, giới hạn ký tự, kích thước ảnh, TODO | như iOS |

## Cấu trúc trong dự án

```
my-app/
└── release/
    ├── release.yml            # bundle id, package, artifact, track, credentials
    ├── questionnaire.yml      # câu trả lời cho store
    ├── CHECKLIST.md           # sinh bởi appship checklist
    ├── ios/metadata/<locale>/*.txt
    ├── ios/screenshots/<locale>/*.png
    ├── android/metadata/<locale>/{*.txt, images/}
    ├── keys/                  # gitignored, chỉ dùng khi không dùng profile
    └── .appship/              # gitignored, file tạm khi chạy fastlane
```

## Tài liệu

- [Thiết kế và các quyết định](design.md): vì sao tool được làm như vậy, phần nào store cho tự động
- [Trạng thái và lộ trình](roadmap.md): đã xong, chưa kiểm chứng, việc tiếp theo
- [Changelog](../CHANGELOG.md)
- [Bắt đầu](getting-started.md): từ zero đến bản release đầu tiên
- [Lấy key store](credentials.md): App Store Connect API key, Google Play service account, profile, biến môi trường
- [Cấu hình release.yml và metadata](configuration.md)
- [questionnaire.yml](questionnaire.md): câu hỏi của store, phần nào tự động, phần nào làm tay
- [Các lệnh](commands.md)
- [Chạy trên CI](ci.md)
- [Xử lý lỗi thường gặp](troubleshooting.md)
- [Phát triển và phát hành tool](development.md)

## License

[MIT](../LICENSE) © Ketchsoft. appship là sản phẩm powered by Ketchsoft.
