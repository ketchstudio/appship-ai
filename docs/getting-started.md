# Bắt đầu

Hướng dẫn này đi từ một dự án chưa từng lên store đến lúc gửi review.

## 0. Chuẩn bị

| Cần có | Ghi chú |
|---|---|
| Tài khoản Apple Developer Program | 99 USD/năm |
| Tài khoản Google Play Console | 25 USD, trả một lần |
| macOS + Xcode | Bắt buộc để build iOS |
| Node 22+ và fastlane | `brew install fastlane` |
| App đã build được bản release và đã ký | Xem mục "Ký app" bên dưới |

## 1. Key store (một lần mỗi tài khoản)

Làm theo [credentials.md](credentials.md) để lấy:

- **iOS:** App Store Connect API key (`.p8`, Key ID, Issuer ID). Không phải Account Holder hoặc Admin thì xem [signing.md](signing.md) (nhờ owner đưa key, hoặc dùng key cá nhân)
- **Android:** Service account JSON đã được cấp quyền trong Play Console

Sau đó:

```bash
appship credentials add my-company
```

## 2. Gắn tool vào dự án

```bash
cd my-app
appship init
```

Lệnh `init` sẽ:

- nhận diện loại dự án (Flutter, React Native, Cocos, native) để điền sẵn `build_command` và đường dẫn artifact
- đọc `applicationId` và `PRODUCT_BUNDLE_IDENTIFIER`
- tạo `release/` với config, questionnaire và metadata mẫu
- thêm `release/keys/*` và `release/.appship/` vào `.gitignore`

Mở `release/release.yml` để kiểm tra lại, đặc biệt là `artifact` và `build_command`.

## 3. Điền nội dung

1. **`release/questionnaire.yml`:** thay mọi `TODO`. Xem [questionnaire.md](questionnaire.md). Có thể nhờ AI agent (Claude Code, Codex, Antigravity) điền bằng skill `app-content` ([skills.md](skills.md)).
2. **Metadata:** `release/ios/metadata/<locale>/*.txt` và `release/android/metadata/<locale>/*.txt`. Muốn nhiều ngôn ngữ (kể cả release notes riêng từng ngôn ngữ): khai báo `ios.locales` / `android.locales` trong `release.yml` rồi tạo thư mục tương ứng, xem [configuration.md](configuration.md).
3. **Screenshots:**
   - iOS: `release/ios/screenshots/<locale>/`. Tối thiểu một bộ iPhone 6.9" (1320x2868) hoặc 6.5" (1284x2778).
   - Android: `release/android/metadata/<locale>/images/`
     - `icon.png` 512x512
     - `featureGraphic.png` 1024x500
     - `phoneScreenshots/`: 2–8 ảnh, nên dùng 1080x1920 (cạnh dài không quá 2 lần cạnh ngắn)
   - Skill `store-screenshots` (dùng với Claude Code, Codex hoặc Antigravity) chụp từ Simulator/emulator, thêm tiêu đề theo từng ngôn ngữ và xuất đúng kích thước ([skills.md](skills.md)).

Nếu app **đã có trên store**, bạn có thể kéo nội dung hiện tại về thay vì điền tay:

```bash
appship metadata pull
```

## 4. Kiểm tra

```bash
appship doctor
```

Sửa đến khi không còn dấu ✗. Dấu `!` là cảnh báo, không chặn release.

## 5. Release lần đầu

```bash
appship build
appship first-release --create-app
```

- **iOS:**
  - Tạo app trên App Store Connect. Bước này cần `apple_id` và có thể hỏi mã 2FA.
  - Đẩy metadata và screenshots, age rating, review info và App Privacy.
- **Android:** Google không có API tạo app, nên tool chỉ in hướng dẫn.
- Cuối cùng tool ghi `release/CHECKLIST.md` gồm các bước phải bấm tay, có sẵn câu trả lời lấy từ questionnaire.

Làm theo CHECKLIST.md. Riêng Android phải:

1. Tạo app trên Play Console.
2. Mời service account vào app.
3. **Upload bản AAB đầu tiên bằng tay** lên Internal testing.
4. Điền mục App content.

Khi app Android còn ở trạng thái draft (chưa publish lần nào), đặt `release_status: draft` trong `release.yml`.

Sau đó:

```bash
appship metadata --android
appship upload
appship submit
```

## 6. Những lần release sau

```bash
# tăng version/build number trong dự án, rồi:
appship upload --build          # build + TestFlight + Google Play track (mặc định internal)
# test trên TestFlight / internal track …
appship submit                  # iOS gửi review; Android promote track → production
appship status                  # theo dõi trạng thái
```

Staged rollout trên Android:

```bash
appship submit --android --rollout 10%
appship promote --from production --to production --rollout 50%
appship promote --from production --to production --rollout 100%
```

## Ký app (signing)

appship **không build hay ký app thay bạn**. Nó chạy `build_command` rồi lấy artifact đã ký.

- **iOS:**
  - Cách đơn giản nhất: Xcode → Signing & Capabilities → Automatic signing, rồi `flutter build ipa` / `fastlane gym`.
  - Với team hoặc CI, dùng [fastlane match](https://docs.fastlane.tools/actions/match/).
  - **Không phải chủ tài khoản, owner đưa file `.p12` và `.mobileprovision`:** khai báo `ios.signing`, chạy `appship signing import`, và để `doctor` kiểm tra. Hướng dẫn cho từng trường hợp (kể cả không có API key): [signing.md](signing.md).
- **Android:**
  - Tạo upload keystore và cấu hình `signingConfigs` trong Gradle.
  - Bật **Play App Signing** khi upload bản đầu.
  - Để keystore ngoài git, ví dụ trong `release/keys/` (đã gitignore) hoặc một vault.
