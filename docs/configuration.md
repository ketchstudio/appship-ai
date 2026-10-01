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
  locales: [en-US, vi, ja]        # tuỳ chọn: các ngôn ngữ trên App Store, xem "Khai báo ngôn ngữ" bên dưới
  signing:                        # tuỳ chọn: ký từ file owner đưa, xem signing.md
    style: manual                 # automatic (mặc định) | manual
    method: app-store-connect     # app-store-connect (mặc định) | app-store (Xcode < 15.3)
    certificate: release/keys/AppleDistribution.p12
    profiles: [release/keys/AppStore.mobileprovision]
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
  locales: [en-US, vi, ja-JP]     # tuỳ chọn: các ngôn ngữ trên Google Play (mã khác iOS)
  upload_screenshots: true
  track: internal                 # internal | alpha (closed) | beta (open) | production
  release_status: completed       # completed | draft | inProgress | halted
  rollout: 1                      # 0 < rollout ≤ 1; < 1 thì tự chuyển release_status sang inProgress

credentials:                      # xem credentials.md
  profile: my-company
  ios: { key_id, issuer_id, key_path, apple_id }   # issuer_id bỏ trống = API key cá nhân
  android: { json_key_path }
```

### Ký iOS bằng file: `ios.signing`

Dùng khi bạn không phải chủ tài khoản và owner đưa certificate (`.p12`) cùng provisioning profile (`.mobileprovision`). Khi có khối này, appship:

- kiểm tra file trong `doctor`;
- cài file lên máy bằng `appship signing import`;
- ghi `release/.appship/ExportOptions.plist` và đưa đường dẫn cho `build_command` qua biến `$APPSHIP_EXPORT_OPTIONS` (kèm `$APPSHIP_IOS_BUNDLE_ID`, `$APPSHIP_IOS_TEAM_ID`).

`build_command` phải dùng biến đó, ví dụ `flutter build ipa --release --export-options-plist="$APPSHIP_EXPORT_OPTIONS"`. Mật khẩu `.p12` truyền bằng `APPSHIP_P12_PASSWORD`, không ghi vào `release.yml`. Chi tiết và các trường hợp: [signing.md](signing.md).

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

### Release notes nhiều ngôn ngữ (iOS)

App Store cho nhập "What's New" riêng cho từng ngôn ngữ, giống Google Play. Mỗi locale là một thư mục, mỗi thư mục có `release_notes.txt` riêng:

```
ios/metadata/
├── en-US/release_notes.txt    # "Bug fixes and performance improvements."
├── vi/release_notes.txt       # "Sửa lỗi và cải thiện hiệu năng."
└── ja/release_notes.txt
```

#### Khai báo ngôn ngữ trong `release.yml`

Mỗi platform có một danh sách `locales` (tuỳ chọn). Đây là danh sách các ngôn ngữ bạn định phát hành, tách riêng cho iOS và Android vì mã locale của hai store khác nhau:

```yaml
ios:
  locales: [en-US, vi, ja]
android:
  locales: [en-US, vi, ja-JP]
```

- Không khai báo `locales` thì appship dùng mọi thư mục có trong `metadata_path` (như trước đây).
- Có khai báo thì `appship doctor` (và `metadata`, `submit`, `upload`) đối chiếu danh sách với các thư mục:
  - Locale có trong danh sách mà chưa có thư mục: **lỗi**, kèm lệnh `mkdir` gợi ý.
  - Thư mục có mặt mà không nằm trong danh sách: **cảnh báo** (thư mục vẫn được đẩy lên store, vì fastlane đẩy mọi thư mục). Thêm vào danh sách hoặc xoá thư mục.
- Danh sách phải là mảng không rỗng, không trùng, và phải chứa `app.primary_locale`. Với iOS, mỗi mã phải nằm trong danh sách locale hợp lệ bên dưới (ví dụ `zh-Hans`, không phải `zh-CN`).
- Skill `release-notes` đọc danh sách này để biết cần viết release notes cho ngôn ngữ nào.

#### Các bước thêm một ngôn ngữ

1. Thêm mã locale vào `ios.locales` (và/hoặc `android.locales`) trong `release/release.yml`.
2. Tạo thư mục `release/ios/metadata/<locale>/` (tên theo bảng bên dưới). `appship doctor` sẽ nhắc nếu quên.
3. Điền các file bắt buộc (`name.txt`, `description.txt`, `keywords.txt`, `support_url.txt`, `privacy_url.txt`) cùng `release_notes.txt`. `doctor` báo lỗi nếu thiếu.
4. Thêm screenshots vào `release/ios/screenshots/<locale>/`. Thiếu thì `doctor` chỉ cảnh báo, riêng locale chính là lỗi.
5. Android: làm tương tự trong `release/android/metadata/<locale>/` (`title.txt`, `short_description.txt`, `full_description.txt`, `changelogs/default.txt`), và bật ngôn ngữ đó trên Play Console trước.
6. `appship doctor` rồi `appship metadata` (hoặc `appship submit`).

Không cần thêm ngôn ngữ trên App Store Connect trước. Nếu version chưa có locale đó, fastlane `deliver` tự tạo khi đẩy metadata.

#### Gói ngôn ngữ gợi ý

Nếu chưa biết nên thêm ngôn ngữ nào, appship gợi ý 6 ngôn ngữ có nhiều người dùng và nhiều app cạnh tranh: Tây Ban Nha (Tây Âu và Mỹ Latin), Bồ Đào Nha (Brazil), Đức, Pháp, Nhật, Hàn. Mã locale của hai store khác nhau, nên gói này ghi rõ từng cột:

| Ngôn ngữ | Id (`--locales`) | Thư mục iOS | Thư mục Android (Play) |
|---|---|---|---|
| Tây Ban Nha (Tây Ban Nha) | `es` | `es-ES` | `es-ES` |
| Tây Ban Nha (Mỹ Latin) | `es` | `es-MX` | `es-419` |
| Bồ Đào Nha (Brazil) | `pt-BR` | `pt-BR` | `pt-BR` |
| Đức | `de` | `de-DE` | `de-DE` |
| Pháp | `fr` | `fr-FR` | `fr-FR` |
| Nhật | `ja` | `ja` | `ja-JP` |
| Hàn | `ko` | `ko` | `ko-KR` |

- **Tạo sẵn khi `init`**: `appship init --locales preset` (đủ 6 ngôn ngữ) hoặc `--locales es,ja` (chỉ một số). Nhập tay thì `init` hiện danh sách để chọn. `init` ghi `locales` vào cả hai platform theo đúng mã của từng store, và tạo thư mục kèm file mẫu có `TODO`. Không truyền `--locales` thì `release.yml` chỉ có dòng `# locales: [...]` dạng comment để bạn bỏ comment khi cần.
- **Dự án đã `init` từ trước**: `init --force` ghi đè `release.yml`, nên nên làm tay theo "Các bước thêm một ngôn ngữ" ở trên, dùng mã trong bảng.
- `es` gồm hai biến thể. `es-ES` dành cho Tây Ban Nha, `es-MX` (iOS) và `es-419` (Play) dành cho cả Mỹ Latin. Chỉ giữ biến thể bạn thật sự sẽ viết riêng, xoá thư mục và bỏ khỏi `locales` phần còn lại. Thêm `fr-CA` (cả hai store) nếu nhắm Canada.
- `doctor` cảnh báo khi platform chỉ có một ngôn ngữ và liệt kê các mã gợi ý.
- Thư mục chỉ là bản mẫu. Bạn (hoặc người dịch) phải thay mọi `TODO` bằng bản dịch thật; `doctor` báo lỗi nếu còn `TODO`.
- Tiếng Nhật và Hàn: giới hạn của store tính theo **ký tự**, không theo byte hay từ. Một chữ Hán, kana hay hangul đều tính là 1, nên văn bản thường ngắn hơn tiếng Anh. Ngược lại tiếng Đức và Pháp dài hơn, hay vượt giới hạn 30 ký tự của tên/phụ đề. `doctor` đếm theo ký tự nên báo đúng trong cả hai trường hợp.
- Skill `release-notes` có hướng dẫn riêng cho từng ngôn ngữ trên: cách xưng hô (`tú`/`ustedes`, `du`/`Sie`, `vous`, thể lịch sự của Nhật/Hàn), biến thể vùng, dấu câu toàn chiều rộng của tiếng Nhật, dấu cách trước `? ! : ;` của tiếng Pháp.

**Lưu ý**

- Mỗi locale chỉ hiện đúng nội dung của nó. Locale không có `release_notes.txt` sẽ để trống "What's New" ở ngôn ngữ đó, nên `doctor` cảnh báo khi một số locale có release notes còn locale khác thì không.
- Version đầu tiên của app không nhận release notes. Để trống `release_notes.txt` ở mọi locale.
- Giới hạn 4000 ký tự cho mỗi locale (Android chỉ 500).
- Thư mục `default` của fastlane (dùng chung một nội dung cho mọi locale) chưa được appship hỗ trợ. `doctor` sẽ coi nó như một locale thật.

**Soạn release notes bằng skill.** `appship init` copy skill `release-notes` vào thư mục skill của agent bạn chọn (`.claude/skills/` cho Claude Code, `.agents/skills/` cho Codex và Antigravity; bỏ qua nếu đã có, nên bản bạn sửa không bị ghi đè). Trong Claude Code, gõ ví dụ "viết release notes cho bản này" hoặc `/release-notes`. Skill sẽ:

1. Đọc `release.yml` (`ios.locales`, `android.locales`) và các thư mục locale hiện có.
2. Lấy thay đổi từ `git log` kể từ tag gần nhất (và `CHANGELOG.md` nếu có).
3. Viết bản cho locale chính, dịch sang các locale còn lại, cắt cho vừa giới hạn (iOS 4000, Android 500 ký tự).
4. Ghi vào `release_notes.txt` (iOS) và `changelogs/default.txt` (Android), hỏi trước khi ghi đè file đã có nội dung, rồi chạy `appship doctor`.

Skill **không** đẩy gì lên store. Bạn đọc và sửa các file, rồi tự chạy `appship metadata` hoặc `appship submit`. Dự án đã `init` từ trước khi có skill: chạy `appship skills add` (xem [skills.md](skills.md)).

**Tên locale iOS hợp lệ** (theo `deliver`, fastlane 2.232.2). Tên khác sẽ bị từ chối với lỗi `Unsupported directory name(s)`:

`ar-SA`, `ca`, `cs`, `da`, `de-DE`, `el`, `en-AU`, `en-CA`, `en-GB`, `en-US`, `es-ES`, `es-MX`, `fi`, `fr-CA`, `fr-FR`, `he`, `hi`, `hr`, `hu`, `id`, `it`, `ja`, `ko`, `ms`, `nl-NL`, `no`, `pl`, `pt-BR`, `pt-PT`, `ro`, `ru`, `sk`, `sv`, `th`, `tr`, `uk`, `vi`, `zh-Hans`, `zh-Hant`.

Locale của iOS và Android không giống nhau. Ví dụ tiếng Trung giản thể là `zh-Hans` trên iOS nhưng `zh-CN` trên Play. Nếu app phát hành cả hai store, đặt tên thư mục theo từng platform, không copy nguyên.

**Category:** `BOOKS`, `BUSINESS`, `DEVELOPER_TOOLS`, `EDUCATION`, `ENTERTAINMENT`, `FINANCE`, `FOOD_AND_DRINK`, `GAMES`, `GRAPHICS_AND_DESIGN`, `HEALTH_AND_FITNESS`, `LIFESTYLE`, `MAGAZINES_AND_NEWSPAPERS`, `MEDICAL`, `MUSIC`, `NAVIGATION`, `NEWS`, `PHOTO_AND_VIDEO`, `PRODUCTIVITY`, `REFERENCE`, `SHOPPING`, `SOCIAL_NETWORKING`, `SPORTS`, `TRAVEL`, `UTILITIES`, `WEATHER`.

Game có subcategory, ví dụ `GAMES_PUZZLE` hoặc `GAMES_CASUAL`. Đặt vào `primary_first_sub_category.txt`.

**Screenshots:** `release/ios/screenshots/<locale>/*.png`. fastlane tự nhận loại thiết bị theo kích thước ảnh.

- Tối thiểu cần một bộ iPhone 6.9" (1320x2868 hoặc 1290x2796) hoặc 6.5" (1284x2778 hoặc 1242x2688).
- Nếu app hỗ trợ iPad, cần thêm iPad 13" (2064x2752 hoặc 2048x2732).
- Tối đa 10 ảnh cho mỗi loại thiết bị.
- Thứ tự trên store theo tên file, nên đặt `01_home.png`, `02_…`.
- Không đặt `_framed` trong tên file: khi thư mục có file `*_framed.png`, deliver chỉ upload các file đó và bỏ qua phần còn lại. `doctor` cảnh báo trường hợp này.
- Ảnh phải là RGB phẳng, không trong suốt. `doctor` cảnh báo PNG có kênh alpha.
- Muốn AI agent chụp và dàn ảnh đúng kích thước: skill `store-screenshots` (xem [skills.md](skills.md)).

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
    ├── featureGraphic.png     # 1024x500, không alpha
    ├── phoneScreenshots/      # 2–8 ảnh
    ├── sevenInchScreenshots/
    └── tenInchScreenshots/
```

Ảnh chụp màn hình của Play: mỗi cạnh từ 320 đến 3840 px, cạnh dài không quá 2 lần cạnh ngắn, JPEG hoặc PNG 24-bit (không alpha). Nên dùng 1080x1920. Ảnh chụp thô từ máy Android đời mới (ví dụ 1080x2400, tỉ lệ 20:9) **bị Play từ chối**, phải đặt vào khung 1080x1920. `doctor` báo lỗi khi sai tỉ lệ hoặc quá 8 ảnh, và cảnh báo khi có alpha. Chỉ thư mục `images/` của locale chính được kiểm tra; ngôn ngữ không có ảnh riêng thì Play dùng ảnh của ngôn ngữ mặc định.

Locale của Play dùng mã như `en-US`, `vi`, `ja-JP`, `ko-KR`, `es-419`, `pt-BR`, `zh-CN`. Tên thư mục phải trùng với ngôn ngữ đã bật trên Play Console.

Danh sách mã Play mà fastlane `supply` biết (2.232.2, `Supply::Languages::ALL_LANGUAGES`; trong file nguồn viết `_`, khi gửi lên API dùng `-`): `af am ar az-AZ be bg bn-BD ca cs-CZ da-DK de-DE el-GR en-AU en-CA en-GB en-IN en-SG en-US en-ZA es-419 es-ES es-US et eu-ES fa fi-FI fil fr-CA fr-FR gl-ES hi-IN hr hu-HU hy-AM id is-IS it-IT iw-IL ja-JP ka-GE km-KH kn-IN ko-KR ky-KG lo-LA lt lv mk-MK ml-IN mn-MN mr-IN ms ms-MY my-MM ne-NP nl-NL no-NO pl-PL pt-BR pt-PT rm ro ru-RU si-LK sk sl sr sv-SE sw ta-IN te-IN th tr-TR uk vi zh-CN zh-HK zh-TW zu`. `supply` không tự kiểm tra tên thư mục, nên appship thêm bước kiểm tra: thư mục Android không nằm trong danh sách này bị **cảnh báo** (không phải lỗi, vì Play có thể thêm ngôn ngữ mới), kèm gợi ý đổi tên khi là mã kiểu iOS (`ja` → `ja-JP`, `zh-Hans` → `zh-CN`, `es-MX` → `es-419`).

Release notes nhiều ngôn ngữ trên Android: mỗi locale có `changelogs/default.txt` riêng, ví dụ `android/metadata/vi/changelogs/default.txt`. Khác với iOS ở chỗ Play cần bật ngôn ngữ trên Play Console trước, và giới hạn là 500 ký tự.
