# Cấu hình: `release/release.yml` và metadata

Mọi đường dẫn tính từ thư mục gốc dự án, tức thư mục chứa `release/`. Glob hỗ trợ `*` và `**`. Nếu nhiều file khớp, tool lấy file mới nhất.

## Tham chiếu `release.yml`

```yaml
app:
  name: "Word Bank"               # bắt buộc; tên trên store và tên dùng khi tạo app
  primary_locale: en-US           # locale chính, đồng thời là tên thư mục metadata

ios:                              # bỏ cả khối nếu không release iOS
  enabled: true                   # false = tạm tắt
  bundle_id: com.example.app      # bắt buộc
  team_id: ABCDE12345             # Developer Portal team, chỉ cần nếu Apple ID thuộc nhiều team
  itc_team_id: "123456"           # App Store Connect team (create-app, App Privacy)
  sku: com.example.app            # mặc định = bundle_id
  skip_devcenter: false           # true = create-app không tạo App ID trên Developer Portal
  version: "1.2.0"                # version App Store để sửa/submit; mặc định là version đang editable
  artifact: "build/ios/ipa/*.ipa"
  build_command: "flutter build ipa --release"
  metadata_path: release/ios/metadata
  screenshots_path: release/ios/screenshots
  upload_screenshots: true
  submit:
    automatic_release: false      # true = tự lên store khi Apple duyệt
    phased_release: false         # true = phát hành dần trong 7 ngày
    reset_ratings: false

android:                          # bỏ cả khối nếu không release Android
  enabled: true
  package_name: com.example.app   # bắt buộc
  artifact: "build/app/outputs/bundle/release/*.aab"
  build_command: "flutter build appbundle --release"
  metadata_path: release/android/metadata
  upload_screenshots: true
  track: internal                 # internal | alpha (closed) | beta (open) | production
  release_status: completed       # completed | draft | inProgress | halted
  rollout: 1                      # 0 < rollout ≤ 1; < 1 thì tự chuyển release_status sang inProgress

credentials:                      # xem credentials.md
  profile: my-company
  ios: { key_id, issuer_id, key_path, apple_id }
  android: { json_key_path }
```

### Giá trị mặc định theo loại dự án (`appship init`)

| Loại | iOS artifact / build | Android artifact / build |
|---|---|---|
| Flutter | `build/ios/ipa/*.ipa` / `flutter build ipa --release` | `build/app/outputs/bundle/release/*.aab` / `flutter build appbundle --release` |
| React Native | `build/ios/*.ipa` / `fastlane gym --project_path ios …` | `android/app/build/outputs/bundle/release/*.aab` / `cd android && ./gradlew bundleRelease` |
| Cocos Creator | `build/ios/**/*.ipa` / (tự build) | `build/android/**/outputs/bundle/release/*.aab` / (tự build) |
| Native | `build/ios/*.ipa` / `fastlane gym --output_directory build/ios` | `app/build/outputs/bundle/release/*.aab` / `./gradlew bundleRelease` |

Với Cocos, bạn có thể đặt `build_command` là lệnh build headless của CocosCreator.app, sau đó export `.ipa` bằng `fastlane gym`.

## Metadata iOS: `release/ios/metadata/`

Theo định dạng của fastlane `deliver`.

```
ios/metadata/
├── copyright.txt              # "2026 Công ty ABC"
├── primary_category.txt       # EDUCATION, GAMES, PRODUCTIVITY…
├── secondary_category.txt
└── en-US/
    ├── name.txt               # ≤ 30 ký tự
    ├── subtitle.txt           # ≤ 30
    ├── description.txt        # ≤ 4000, bắt buộc
    ├── keywords.txt           # ≤ 100, phân cách bằng dấu phẩy, bắt buộc
    ├── promotional_text.txt   # ≤ 170, sửa được cả khi app đang live
    ├── release_notes.txt      # "What's New", ≤ 4000; để TRỐNG ở version đầu tiên
    ├── support_url.txt        # bắt buộc
    ├── marketing_url.txt
    └── privacy_url.txt        # bắt buộc
```

**Category:** `BOOKS`, `BUSINESS`, `DEVELOPER_TOOLS`, `EDUCATION`, `ENTERTAINMENT`, `FINANCE`, `FOOD_AND_DRINK`, `GAMES`, `GRAPHICS_AND_DESIGN`, `HEALTH_AND_FITNESS`, `LIFESTYLE`, `MAGAZINES_AND_NEWSPAPERS`, `MEDICAL`, `MUSIC`, `NAVIGATION`, `NEWS`, `PHOTO_AND_VIDEO`, `PRODUCTIVITY`, `REFERENCE`, `SHOPPING`, `SOCIAL_NETWORKING`, `SPORTS`, `TRAVEL`, `UTILITIES`, `WEATHER`.

Game có subcategory, ví dụ `GAMES_PUZZLE` hoặc `GAMES_CASUAL`. Đặt vào `primary_first_sub_category.txt`.

**Screenshots:** `release/ios/screenshots/<locale>/*.png`. fastlane tự nhận loại thiết bị theo kích thước ảnh.

- Tối thiểu cần một bộ iPhone 6.9" (1320x2868 hoặc 1290x2796) hoặc 6.5" (1284x2778 hoặc 1242x2688).
- Nếu app hỗ trợ iPad, cần thêm iPad 13" (2064x2752 hoặc 2048x2732).
- Tối đa 10 ảnh cho mỗi loại thiết bị.

## Metadata Android: `release/android/metadata/`

Theo định dạng của fastlane `supply`.

```
android/metadata/en-US/
├── title.txt                  # ≤ 30, bắt buộc
├── short_description.txt      # ≤ 80, bắt buộc
├── full_description.txt       # ≤ 4000, bắt buộc
├── video.txt                  # URL YouTube
├── changelogs/
│   ├── default.txt            # "What's new", ≤ 500
│   └── 42.txt                 # riêng cho versionCode 42 (ưu tiên hơn default)
└── images/
    ├── icon.png               # 512x512
    ├── featureGraphic.png     # 1024x500
    ├── phoneScreenshots/      # 2–8 ảnh
    ├── sevenInchScreenshots/
    └── tenInchScreenshots/
```

Locale của Play dùng mã như `en-US`, `vi`, `ja-JP`, `zh-CN`. Tên thư mục phải trùng với ngôn ngữ đã bật trên Play Console.
