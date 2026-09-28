# `release/questionnaire.yml`: câu hỏi của store

Mọi câu trả lời cho các câu hỏi bắt buộc của store được khai báo **một lần** trong file này, rồi appship xử lý như sau:

- Câu nào store có API: tool tự điền khi chạy `metadata`, `submit` hoặc `first-release`.
- Câu nào không có API: `appship checklist` in ra `release/CHECKLIST.md` kèm câu trả lời, bạn chỉ cần bấm theo.

`appship doctor` báo lỗi khi còn `TODO` hoặc thiếu câu trả lời.

## Phần nào tự động?

| Câu hỏi | iOS | Android |
|---|---|---|
| Export compliance (mã hoá) | ✅ khi submit | n/a |
| Content rights (nội dung bên thứ ba) | ✅ khi submit | n/a |
| Age rating | ✅ metadata/submit | ❌ IARC questionnaire, xem checklist |
| Thông tin cho reviewer, tài khoản demo | ✅ metadata/submit | ❌ App access, xem checklist |
| Privacy | ✅ App Privacy, cần `apple_id` | ❌ Data safety, xem checklist |
| Quảng cáo | ✅ (`age_rating.advertising`) | ❌ checklist |
| Target audience | n/a | ❌ checklist |
| Giá, quốc gia | ❌ checklist | ❌ checklist |

## iOS

```yaml
ios:
  export_compliance:
    uses_non_exempt_encryption: false
  content_rights:
    uses_third_party_content: false
  review_information:
    first_name: Minh
    last_name: Tran
    phone_number: "+84 912 345 678"
    email_address: dev@example.com
    demo_user: reviewer@example.com       # nếu app bắt đăng nhập
    demo_password: "…"
    notes: "Tap 'Skip' on onboarding."
  age_rating: { … }
  privacy: { … }
```

### Export compliance

- Chỉ dùng HTTPS hoặc crypto có sẵn của iOS: `false`.
- Có tự triển khai mã hoá (thư viện crypto riêng, VPN…): `true`, và có thể phải nộp thêm tài liệu cho Apple.

Nên đặt thêm `ITSAppUsesNonExemptEncryption = NO` trong `Info.plist` để TestFlight không hỏi lại ở mỗi build.

### Age rating

Các khóa theo App Store Connect API. Mức cho các khóa nội dung: `NONE`, `INFREQUENT_OR_MILD`, `FREQUENT_OR_INTENSE`.

| Khóa | Ý nghĩa |
|---|---|
| `alcoholTobaccoOrDrugUseOrReferences` | Rượu, thuốc lá, chất kích thích |
| `contests` | Cuộc thi |
| `gamblingSimulated` | Cờ bạc mô phỏng (không dùng tiền thật) |
| `gunsOrOtherWeapons` | Súng, vũ khí |
| `horrorOrFearThemes` | Kinh dị |
| `matureOrSuggestiveThemes` | Chủ đề người lớn hoặc gợi dục |
| `medicalOrTreatmentInformation` | Thông tin y tế |
| `profanityOrCrudeHumor` | Tục tĩu, hài thô |
| `sexualContentOrNudity` / `sexualContentGraphicAndNudity` | Nội dung tình dục |
| `violenceCartoonOrFantasy` / `violenceRealistic` / `violenceRealisticProlongedGraphicOrSadistic` | Bạo lực |

Các khóa `true`/`false`:

| Khóa | Ý nghĩa |
|---|---|
| `advertising` | Có quảng cáo |
| `ageAssurance` | Có xác minh tuổi |
| `gambling` | Cờ bạc tiền thật |
| `healthOrWellnessTopics` | Chủ đề sức khoẻ |
| `lootBox` | Có loot box |
| `messagingAndChat` | Có nhắn tin, chat |
| `parentalControls` | Có kiểm soát của phụ huynh |
| `unrestrictedWebAccess` | Có trình duyệt web tự do |
| `userGeneratedContent` | Có nội dung do người dùng tạo |

Khóa tuỳ chọn: `kidsAgeBand` (chỉ dùng cho app thuộc Kids category).

### App Privacy

```yaml
privacy:
  collects_data: true
  data:
    - category: EMAIL_ADDRESS
      purposes: [APP_FUNCTIONALITY]
      linked_to_user: true
      used_for_tracking: false
    - category: CRASH_DATA
      purposes: [ANALYTICS]
      linked_to_user: false
      used_for_tracking: false
```

**Category** thường gặp:

- Liên hệ: `NAME`, `EMAIL_ADDRESS`, `PHONE_NUMBER`, `PHYSICAL_ADDRESS`, `OTHER_CONTACT_INFO`
- Sức khoẻ và tài chính: `HEALTH`, `FITNESS`, `PAYMENT_INFORMATION`, `CREDIT_AND_FRAUD`, `OTHER_FINANCIAL_INFO`
- Vị trí: `PRECISE_LOCATION`, `COARSE_LOCATION`
- Dữ liệu nhạy cảm và danh bạ: `SENSITIVE_INFO`, `CONTACTS`
- Nội dung người dùng: `EMAILS_OR_TEXT_MESSAGES`, `PHOTOS_OR_VIDEOS`, `AUDIO`, `GAMEPLAY_CONTENT`, `CUSTOMER_SUPPORT`, `OTHER_USER_CONTENT`
- Lịch sử: `BROWSING_HISTORY`, `SEARCH_HISTORY`
- Định danh: `USER_ID`, `DEVICE_ID`
- Hành vi sử dụng: `PURCHASE_HISTORY`, `PRODUCT_INTERACTION`, `ADVERTISING_DATA`, `OTHER_USAGE_DATA`
- Chẩn đoán: `CRASH_DATA`, `PERFORMANCE_DATA`, `OTHER_DIAGNOSTIC_DATA`
- Khác: `OTHER_DATA_TYPES`

Nếu không chắc tên category, chạy `fastlane run upload_app_privacy_details_to_app_store` một lần ở chế độ tương tác để xem danh sách hiện hành.

**Purposes:** `APP_FUNCTIONALITY`, `ANALYTICS`, `PRODUCT_PERSONALIZATION`, `DEVELOPERS_ADVERTISING`, `THIRD_PARTY_ADVERTISING`, `OTHER_PURPOSES`.

**Lưu ý:** SDK bên thứ ba cũng tính là app thu thập dữ liệu. Ví dụ Firebase Analytics, Crashlytics, AdMob thường thu `DEVICE_ID`, `PRODUCT_INTERACTION`, `CRASH_DATA`.

## Android

Không có API cho phần này, nên appship chỉ đưa câu trả lời vào CHECKLIST.md. Nên điền đủ để cả team trả lời nhất quán giữa các lần cập nhật.

```yaml
android:
  privacy_policy_url: https://example.com/privacy
  app_access: { restricted: true, instructions: "Login: reviewer@example.com / …" }
  contains_ads: false
  target_audience: { age_groups: ["13-15", "16-17", "18+"], appeals_to_children: false }
  content_rating:
    email: dev@example.com
    category: "All other app types"
    violence: false
    # …
  data_safety:
    collects_data: true
    shares_data: false
    encrypted_in_transit: true
    deletion_request: true
    data:
      - type: "Email address"
        collected: true
        shared: false
        optional: false
        purposes: ["App functionality", "Account management"]
```

Nếu chọn nhóm tuổi dưới 13, app phải tuân thủ chính sách Families của Google Play, với nhiều giới hạn về quảng cáo và SDK.
