# Ký app iOS khi bạn không phải chủ tài khoản

Trên iOS có hai việc tách biệt, và mỗi việc cần một thứ khác nhau:

| Việc | Cần gì | Do ai cấp |
|---|---|---|
| **Ký** app (tạo `.ipa` hợp lệ) | Certificate **Apple Distribution** kèm private key (`.p12`) và provisioning profile loại **App Store** (`.mobileprovision`) | Account Holder hoặc Admin tạo ở Developer Portal |
| **Đẩy** lên App Store Connect (upload, metadata, submit) | App Store Connect API key (`.p8`), hoặc tải tay bằng Transporter / Xcode | Team key: Account Holder hoặc Admin. Individual key: chính bạn |

appship **không build và không ký** app (xem [design.md](design.md), quyết định 2). Nó làm 3 việc quanh chuyện ký:

1. **Kiểm tra** (`appship doctor`): file signing còn hạn không, đúng loại không, đúng bundle id và team không, certificate đã có trong keychain chưa, `.ipa` đã build được ký bằng profile nào.
2. **Cài** certificate và profile lên máy (`appship signing import`), dùng cho cả máy local và CI.
3. **Truyền cách ký cho lệnh build** qua file `ExportOptions.plist` (biến `$APPSHIP_EXPORT_OPTIONS`).

> Giao diện Apple thay đổi thường xuyên. Các bước dưới đây đúng tại thời điểm viết (09/2026). Quyền chính xác của từng role nằm trong bảng *Role permissions* của App Store Connect Help. Tài liệu này chỉ nêu những gì cần cho việc release.

## Bạn thuộc trường hợp nào?

| # | Tình huống | Ký bằng | Đẩy lên store bằng | Xem mục |
|---|---|---|---|---|
| 1 | Bạn là Account Holder hoặc Admin | Xcode tự ký (mặc định) hoặc `fastlane match` | Team API key | [Trường hợp 1](#trường-hợp-1-bạn-là-account-holder-hoặc-admin) |
| 2 | Owner đưa bạn file signing **và** team API key | File (`ios.signing`) | Team API key | [Trường hợp 2](#trường-hợp-2-owner-đưa-file-signing-và-team-api-key) |
| 3 | Owner đưa file signing, **không** đưa API key | File (`ios.signing`) | API key cá nhân của bạn (không có Issuer ID) | [Trường hợp 3](#trường-hợp-3-owner-đưa-file-signing-nhưng-không-đưa-api-key) |
| 4 | Không có API key nào, kể cả cá nhân | File hoặc Xcode | Tải tay bằng Transporter / Xcode Organizer | [Trường hợp 4](#trường-hợp-4-không-có-api-key-nào) |
| 5 | Owner chỉ đưa API key, không đưa file signing | Cần owner tạo thêm certificate và profile | API key | [Trường hợp 5](#trường-hợp-5-owner-chỉ-đưa-api-key) |

Trong mọi trường hợp, `appship doctor` cho biết còn thiếu gì.

## Trường hợp 1: bạn là Account Holder hoặc Admin

Không cần làm gì thêm.

- Tạo Team key theo [credentials.md](credentials.md).
- Để Xcode tự ký (automatic signing). Không cần khai báo `ios.signing`.
- Muốn nhiều máy hoặc CI dùng chung một bộ signing, có thể dùng [`fastlane match`](https://docs.fastlane.tools/actions/match/). appship không quản lý match: chạy `fastlane match appstore --readonly` trước `build_command` (ví dụ trong một bước riêng của CI).

## Trường hợp 2: owner đưa file signing và team API key

### Bước 1. Nhờ owner gửi gì

| File | Owner lấy ở đâu | Ghi chú |
|---|---|---|
| Certificate **Apple Distribution** dạng `.p12` | Keychain Access → mục **My Certificates** → chuột phải → **Export…** → đặt mật khẩu | Phải là file **có private key**. File `.cer` tải từ Developer Portal không đủ |
| Provisioning profile **App Store** dạng `.mobileprovision` | [Developer Portal](https://developer.apple.com/account) → **Profiles** → **+** → Distribution → **App Store Connect**, chọn đúng App ID và certificate | Mỗi bundle id một profile. App có extension (widget, notification…) thì cần thêm profile cho từng extension |
| Team API key: `.p8`, Key ID, Issuer ID | Xem [credentials.md](credentials.md) | Không bắt buộc, xem trường hợp 3 và 4 |

Gửi `.p12`, mật khẩu của nó và `.p8` qua **các kênh riêng** (password manager). Không gửi chung một tin nhắn.

> **Cách an toàn hơn, không phải chuyển private key:** bạn tự tạo CSR trên máy mình (Keychain Access → Certificate Assistant → *Request a Certificate From a Certificate Authority…*, chọn *Saved to disk*), gửi file `.certSigningRequest` cho owner. Owner tạo certificate Apple Distribution từ CSR đó ở Developer Portal, rồi gửi lại file `.cer` cùng profile. Bạn double-click `.cer` để cài. Khi đó private key chưa từng rời máy bạn, và bạn không cần `.p12` (bỏ dòng `certificate` trong `release.yml`).

### Bước 2. Đặt file vào dự án

```
release/keys/AppleDistribution.p12
release/keys/AppStore.mobileprovision
```

Thư mục `release/keys/` đã được gitignore. Đừng commit các file này.

### Bước 3. Khai báo trong `release/release.yml`

```yaml
ios:
  bundle_id: com.example.app
  team_id: ABCDE12345                  # nên khai báo để doctor đối chiếu với profile
  build_command: 'flutter build ipa --release --export-options-plist="$APPSHIP_EXPORT_OPTIONS"'
  signing:
    style: manual
    certificate: release/keys/AppleDistribution.p12
    profiles:
      - release/keys/AppStore.mobileprovision
      # - release/keys/AppStore-Widget.mobileprovision   # mỗi extension một profile
```

Mật khẩu `.p12` **không bao giờ** ghi vào `release.yml`. Truyền bằng biến môi trường `APPSHIP_P12_PASSWORD` (hoặc nhập khi được hỏi).

### Bước 4. Cài lên máy

```bash
appship signing import --dry-run     # xem sẽ làm gì
appship signing import               # hỏi xác nhận, hỏi mật khẩu .p12
appship doctor
```

Lệnh này:

- Copy profile vào thư mục Xcode đọc profile, đặt tên `<UUID>.mobileprovision`. Xcode 16 trở lên dùng `~/Library/Developer/Xcode/UserData/Provisioning Profiles`, bản cũ hơn dùng `~/Library/MobileDevice/Provisioning Profiles`. Không đọc được phiên bản Xcode thì copy vào cả hai.
- Import `.p12` vào keychain (mặc định là login keychain). Nếu certificate của profile đã có trong keychain thì bỏ qua bước import.
- Ghi `release/.appship/ExportOptions.plist`.

Mật khẩu `.p12` được truyền cho lệnh `security import`, nên trong lúc chạy nó xuất hiện trong danh sách tiến trình của máy (giống cách fastlane làm). Trên máy dùng chung, hãy dùng máy riêng hoặc CI.

### Bước 5. Build và upload

`build_command` phải dùng `$APPSHIP_EXPORT_OPTIONS`, nếu không lệnh build sẽ bỏ qua `ios.signing` (`doctor` sẽ cảnh báo):

| Công cụ build | Cách dùng |
|---|---|
| Flutter | `flutter build ipa --release --export-options-plist="$APPSHIP_EXPORT_OPTIONS"` |
| fastlane gym | `fastlane gym --export_options "$APPSHIP_EXPORT_OPTIONS" --output_directory build/ios ...` |
| xcodebuild | `xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/ios -exportOptionsPlist "$APPSHIP_EXPORT_OPTIONS"` |

`ExportOptions.plist` chỉ quyết định bước **export**. Bước archive vẫn theo cài đặt signing trong project Xcode. Với `style: manual`, hãy tắt *Automatically manage signing* trong project (Signing & Capabilities) và chọn đúng profile cho từng target, nếu không bước archive có thể tự ký theo cách khác.

Ngoài `$APPSHIP_EXPORT_OPTIONS`, `build_command` còn nhận `$APPSHIP_IOS_BUNDLE_ID` và `$APPSHIP_IOS_TEAM_ID` (nếu biết team).

Sau đó:

```bash
appship build --ios
appship doctor           # kiểm tra .ipa vừa build được ký bằng profile nào
appship upload --ios
```

Chỉ cần ExportOptions mà chưa muốn cài gì: `appship signing export-options`.

## Trường hợp 3: owner đưa file signing nhưng không đưa API key

Làm như trường hợp 2, và tạo **API key cá nhân** (Individual key) cho chính bạn:

1. Vào App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**.
2. Chọn tab **Individual Keys** (nếu chưa thấy, xem lưu ý bên dưới) → tạo key → tải `AuthKey_XXXXXXXXXX.p8` (chỉ tải được một lần) và ghi lại **Key ID**.
3. Thêm key, **để trống Issuer ID**:

```bash
appship credentials add my-key --asc-key ~/Downloads/AuthKey_XXXXXXXXXX.p8 --asc-key-id XXXXXXXXXX
```

Khác biệt so với Team key:

- Individual key **không có Issuer ID**. appship chấp nhận `issuer_id` để trống và `doctor` sẽ báo *"treated as an individual App Store Connect API key"*.
- Key gắn với tài khoản của bạn và quyền của bạn. Bạn chỉ làm được những gì role của bạn được làm (ví dụ upload build cần role đủ quyền, như App Manager hoặc Developer; Marketing thì không).
- Mỗi người chỉ có một key cá nhân đang hoạt động.
- Admin có thể tắt quyền tạo key cá nhân, và Apple có thể đổi cách này. Nếu bạn không thấy tab, hỏi owner, hoặc dùng trường hợp 4.

> **Chưa kiểm chứng.** appship đã hỗ trợ key không có Issuer ID (fastlane cũng hỗ trợ), nhưng chưa được thử với key cá nhân thật. Nếu gặp lỗi xác thực, xem [troubleshooting.md](troubleshooting.md) và báo lại.

## Trường hợp 4: không có API key nào

Vẫn ký và build được bằng file (trường hợp 2). Chỉ bước đẩy lên store phải làm tay:

- Upload `.ipa` bằng **Transporter** (app của Apple trên Mac App Store), hoặc **Xcode → Window → Organizer → Distribute App**. Cả hai đăng nhập bằng Apple ID của bạn.
- Hoặc nhờ owner upload file `.ipa`.
- Metadata, screenshots và submit làm trên web App Store Connect. `appship checklist` sinh sẵn nội dung để dán.

appship **không** hỗ trợ upload bằng Apple ID (không API key), vì cách này cần đăng nhập tương tác có 2FA, không chạy được trên CI và không ổn định.

Bạn vẫn dùng `appship signing import`, `appship build` và `appship doctor` (kiểm tra `.ipa` trước khi tải tay) bình thường. Chỉ không dùng được `upload`, `metadata`, `submit`, `status`.

## Trường hợp 5: owner chỉ đưa API key

API key không ký được app. Bạn vẫn cần certificate và profile:

- Nhờ owner (hoặc một Admin) tạo và gửi như trường hợp 2, **hoặc**
- Nếu role của bạn cho phép, thêm Apple ID của bạn vào Xcode (Settings → Accounts) và dùng automatic signing. Automatic signing cần quyền tạo certificate và profile, tuỳ role. Xem bảng role của Apple. Nếu Xcode báo không đủ quyền thì quay lại cách thứ nhất.

## Chạy trên CI

Trên runner macOS, giải mã secrets ra file rồi import vào một keychain **riêng** (không đụng login keychain của runner):

```yaml
- name: Signing files
  run: |
    mkdir -p release/keys
    echo "$IOS_DIST_P12_BASE64"       | base64 --decode > release/keys/AppleDistribution.p12
    echo "$IOS_PROFILE_BASE64"        | base64 --decode > release/keys/AppStore.mobileprovision
  env:
    IOS_DIST_P12_BASE64: ${{ secrets.IOS_DIST_P12_BASE64 }}
    IOS_PROFILE_BASE64: ${{ secrets.IOS_PROFILE_BASE64 }}

- name: Import signing
  run: appship signing import --yes --keychain "$RUNNER_TEMP/appship.keychain-db"
  env:
    APPSHIP_P12_PASSWORD: ${{ secrets.IOS_DIST_P12_PASSWORD }}
    APPSHIP_KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}   # mật khẩu bất kỳ, dùng cho keychain tạm

- run: appship doctor --skip-screenshots
- run: appship build --ios
- run: appship upload --ios --yes
```

Với `--keychain`, appship tạo keychain (nếu chưa có), mở khoá, thêm vào danh sách keychain của user, import `.p12` và cấp quyền cho `codesign` dùng key mà không hiện hộp thoại. Trên CI không có người bấm, nên bước cấp quyền này là bắt buộc.

Danh sách secrets: xem [ci.md](ci.md).

## `appship doctor` kiểm tra gì?

Mục **iOS · signing** xuất hiện khi có `ios.signing` hoặc có file `.ipa`:

| Kiểm tra | Mức |
|---|---|
| `build_command` không dùng `$APPSHIP_EXPORT_OPTIONS` | cảnh báo |
| Profile khai báo không tồn tại hoặc không đọc được | lỗi |
| Profile không phải loại App Store (ad-hoc, development, enterprise), hoặc không phải iOS | lỗi |
| Profile đã hết hạn | lỗi |
| Profile hết hạn trong dưới 30 ngày | cảnh báo |
| Team của profile khác `ios.team_id` | lỗi |
| Mọi certificate trong profile đã hết hạn | lỗi |
| Không profile nào khớp `ios.bundle_id` (hỗ trợ App ID wildcard `com.x.*`) | lỗi |
| File `.p12` không tồn tại, hoặc quyền đọc rộng hơn 600 | lỗi / cảnh báo |
| Certificate của profile chưa có trong keychain kèm private key | lỗi (cảnh báo nếu đã khai báo `certificate`, vì `signing import` sẽ cài) |
| `.ipa` được ký cho bundle id khác `ios.bundle_id` | lỗi |
| `.ipa` được ký bằng profile không nằm trong `ios.signing.profiles` | cảnh báo |
| `.ipa` được ký bằng profile sai loại, hết hạn, hoặc sai team | như trên |

Kiểm tra certificate trong keychain chỉ chạy trên macOS. Chỉ certificate còn hiệu lực và có private key mới được tính. Certificate tự ký (thường gặp khi thử nghiệm) không được tính là hợp lệ.

## Tham chiếu `ios.signing`

```yaml
ios:
  signing:
    style: manual                 # automatic (mặc định) | manual
    method: app-store-connect     # app-store-connect (mặc định) | app-store
    certificate: release/keys/AppleDistribution.p12   # chỉ khi style: manual; bỏ nếu certificate đã có trong keychain
    profiles: [release/keys/AppStore.mobileprovision] # bắt buộc khi style: manual
```

| Trường | Ý nghĩa |
|---|---|
| `style` | `automatic`: Xcode tự ký. `manual`: dùng certificate và profile ở dưới |
| `method` | Giá trị `method` trong `ExportOptions.plist`. Xcode 15.3 trở lên dùng `app-store-connect`. Xcode cũ hơn chỉ hiểu `app-store` |
| `certificate` | Đường dẫn `.p12`. Chỉ `signing import` dùng file này |
| `profiles` | Danh sách `.mobileprovision`. Profile có App ID wildcard được gán cho `ios.bundle_id` |

Khối `signing` không có thì appship không đụng vào chuyện ký, giống các phiên bản trước.

Biến môi trường:

| Biến | Nội dung |
|---|---|
| `APPSHIP_P12_PASSWORD` | Mật khẩu file `.p12`. Bỏ trống thì hỏi khi chạy tương tác; trên CI là bắt buộc (có thể đặt rỗng nếu `.p12` không có mật khẩu) |
| `APPSHIP_KEYCHAIN_PASSWORD` | Mật khẩu cho keychain riêng khi dùng `--keychain` |

## Khi profile hoặc certificate sắp hết hạn

Profile và certificate Apple Distribution đều có hạn khoảng 1 năm. `doctor` cảnh báo trước 30 ngày. Khi đó:

1. Nhờ owner gia hạn: Developer Portal → Profiles → chọn profile → Edit → Save, rồi tải lại. Nếu certificate cũng hết hạn thì tạo certificate mới và tạo lại profile với certificate đó.
2. Thay file trong `release/keys/`, chạy lại `appship signing import`.
3. Cập nhật secrets trên CI.
