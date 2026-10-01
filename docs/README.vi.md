# appship-ai (tiếng Việt)

[English](../README.md) · **Tiếng Việt** · [Website](https://appship.ketchsoft.com/vi/)

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

# Từ npm: cung cấp lệnh appship (và alias appship-ai)
npm i -g appship-ai
appship doctor
npx appship-ai doctor          # hoặc chạy không cần cài

# Từ GitHub
npm i -g git+https://github.com/ketchstudio/appship-ai.git

# Khi đang phát triển tool
git clone https://github.com/ketchstudio/appship-ai.git
cd appship-ai && npm install && npm link
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
| Kiểm tra trước | `doctor`: key, key lỡ commit, giới hạn ký tự, kích thước ảnh, TODO, file signing (profile, certificate, `.ipa`) | như iOS, trừ signing |

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

## Release notes nhiều ngôn ngữ

Cả hai store đều nhận release notes riêng cho từng ngôn ngữ. Mỗi locale là một thư mục:

- **iOS** ("What's New", tối đa 4000 ký tự): `release/ios/metadata/<locale>/release_notes.txt`, ví dụ `en-US`, `vi`, `ja`, `zh-Hans`. Locale chưa có trên App Store Connect sẽ được tạo tự động. Version đầu tiên của app thì để trống, vì Apple không nhận release notes ở version này.
- **Android** (tối đa 500 ký tự): `release/android/metadata/<locale>/changelogs/default.txt`. Ngôn ngữ phải được bật trên Play Console trước.

`appship init` cũng cài sẵn skill `release-notes` của Claude Code vào `.claude/skills/`. Nhờ Claude "viết release notes" thì nó đọc `git log` từ tag gần nhất, viết bản cho locale chính, dịch sang mọi thư mục locale, cắt cho vừa giới hạn của store rồi chạy `appship doctor`. Skill chỉ sửa các file ở trên; bạn đọc lại rồi tự đẩy lên store. Release notes vẫn là file thường nên bạn luôn sửa tay được.

Khai báo ngôn ngữ theo từng platform trong `release.yml` (tuỳ chọn; không khai báo thì dùng mọi thư mục có sẵn):

```yaml
ios:
  locales: [en-US, vi, ja]
android:
  locales: [en-US, vi, ja-JP]
```

Khi đó `appship doctor` báo lỗi nếu locale có trong danh sách mà chưa có thư mục, cảnh báo nếu có thư mục mà không nằm trong danh sách, và từ chối tên locale iOS sai trước khi fastlane làm việc đó. Mã locale của iOS và Android khác nhau (`zh-Hans` và `zh-CN`), nên đặt tên thư mục theo từng platform. `appship doctor` kiểm tra độ dài và cảnh báo khi một số locale có release notes còn locale khác thì không. Danh sách locale iOS hợp lệ nằm trong [configuration.md](configuration.md).

### Ngôn ngữ gợi ý

Muốn mở rộng ngoài ngôn ngữ chính, chạy `appship init --locales preset` (hoặc `--locales es,ja`). Lệnh tạo thư mục cho tiếng Tây Ban Nha (Tây Ban Nha và Mỹ Latin), Bồ Đào Nha (Brazil), Đức, Pháp, Nhật, Hàn, và ghi `locales` cho từng platform theo đúng mã của store đó:

| Ngôn ngữ | Thư mục iOS | Thư mục Android |
|---|---|---|
| Tây Ban Nha, Tây Ban Nha / Mỹ Latin | `es-ES` / `es-MX` | `es-ES` / `es-419` |
| Bồ Đào Nha, Brazil | `pt-BR` | `pt-BR` |
| Đức | `de-DE` | `de-DE` |
| Pháp | `fr-FR` | `fr-FR` |
| Nhật | `ja` | `ja-JP` |
| Hàn | `ko` | `ko-KR` |

Thư mục mới chứa `TODO`, `appship doctor` báo lỗi cho đến khi bạn dịch xong. `doctor` cũng cảnh báo thư mục Android không phải mã ngôn ngữ của Google Play (ví dụ `ja` thay vì `ja-JP`) và gợi ý mã đúng. Skill `release-notes` biết quy ước từng ngôn ngữ (xưng hô, biến thể vùng, dấu câu tiếng Nhật, khoảng trắng tiếng Pháp). Chi tiết ở [configuration.md](configuration.md#gói-ngôn-ngữ-gợi-ý).

## Ký iOS khi bạn không phải chủ tài khoản

Team API key, certificate và profile đều cần Account Holder hoặc Admin. Nếu owner đưa file cho bạn, appship làm việc được với chúng (tool vẫn không build hay ký thay bạn: nó kiểm tra file, cài file và truyền cách ký cho lệnh build):

```yaml
ios:
  build_command: 'flutter build ipa --release --export-options-plist="$APPSHIP_EXPORT_OPTIONS"'
  signing:
    style: manual
    certificate: release/keys/AppleDistribution.p12           # certificate Apple Distribution + private key
    profiles: [release/keys/AppStore.mobileprovision]         # profile App Store, mỗi bundle id một file
```

```bash
APPSHIP_P12_PASSWORD=... appship signing import   # cài profile, import .p12
appship doctor                                    # loại/hạn/team/bundle id của profile, keychain, .ipa vừa build
```

- Không có Team API key: tạo API key **cá nhân** (không có Issuer ID, để trống `issuer_id`). Chưa kiểm chứng với tài khoản thật.
- Không có API key nào: ký và build như trên, rồi tải `.ipa` bằng Transporter hoặc Xcode.
- Cả 5 trường hợp, CI, và danh sách `doctor` kiểm tra: [signing.md](signing.md).

## Tài liệu

- [Thiết kế và các quyết định](design.md): vì sao tool được làm như vậy, phần nào store cho tự động
- [Trạng thái và lộ trình](roadmap.md): đã xong, chưa kiểm chứng, việc tiếp theo
- [Changelog](../CHANGELOG.md)
- [Bắt đầu](getting-started.md): từ zero đến bản release đầu tiên
- [Lấy key store](credentials.md): App Store Connect API key (kể cả key cá nhân), Google Play service account, profile, biến môi trường
- [Ký iOS khi không phải owner](signing.md): certificate, profile, `ios.signing`, `appship signing`, CI
- [Cấu hình release.yml và metadata](configuration.md)
- [questionnaire.yml](questionnaire.md): câu hỏi của store, phần nào tự động, phần nào làm tay
- [Các lệnh](commands.md)
- [Chạy trên CI](ci.md)
- [Xử lý lỗi thường gặp](troubleshooting.md)
- [Phát triển và phát hành tool](development.md)

## License

[MIT](../LICENSE) © Ketchsoft. appship là sản phẩm powered by Ketchsoft.
