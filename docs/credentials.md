# Key store và credentials

appship cần 2 loại key. Cả hai đều cho phép đẩy build lên store dưới tên bạn, nên **không bao giờ commit chúng vào git**.

| Platform | Key | Dùng cho |
|---|---|---|
| iOS | App Store Connect API key (`.p8` + Key ID + Issuer ID) | Upload, metadata, submit, status |
| iOS (nếu không phải owner) | API key **cá nhân** (`.p8` + Key ID, không có Issuer ID) | Như trên, với quyền của chính bạn |
| iOS (tuỳ chọn) | Apple ID (email) | Chỉ dùng cho `--create-app` và upload App Privacy, vì Apple không cho API key làm 2 việc này |
| Android | Google Play service account JSON | Mọi thao tác Android |

> Giao diện console của Apple và Google thay đổi thường xuyên. Các bước dưới đây đúng tại thời điểm viết (09/2026).

## iOS: App Store Connect API key

1. Vào [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → tab **Integrations** → **App Store Connect API**.
2. Chọn **Team Keys** → nút **+**.
3. Đặt tên, ví dụ `appship`, và chọn quyền **App Manager**. Quyền Admin cũng được nhưng rộng hơn mức cần.
4. Tải file `AuthKey_XXXXXXXXXX.p8`. **Apple chỉ cho tải một lần.**
5. Ghi lại:
   - **Key ID:** chuỗi 10 ký tự, cũng nằm trong tên file.
   - **Issuer ID:** UUID hiển thị phía trên bảng key.

Team key chỉ Account Holder hoặc Admin tạo được. **Bạn không phải owner?** Có hai cách:

- Nhờ owner tạo Team key và gửi `.p8`, Key ID, Issuer ID qua kênh riêng.
- Tự tạo API key cá nhân, mục dưới.

### iOS: API key cá nhân (không phải owner)

1. Vào App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**.
2. Chọn tab **Individual Keys** và tạo key. Nếu không thấy tab hoặc nút tạo, có thể Admin đã tắt quyền này với role của bạn. Hỏi owner.
3. Tải `AuthKey_XXXXXXXXXX.p8` (chỉ tải được một lần) và ghi lại **Key ID**.
4. **Không có Issuer ID.** Để trống trường này:

   ```bash
   appship credentials add my-key --asc-key ~/Downloads/AuthKey_XXXXXXXXXX.p8 --asc-key-id XXXXXXXXXX
   ```

Lưu ý:

- Key cá nhân gắn với tài khoản và quyền của bạn, nên chỉ làm được những gì role của bạn được làm.
- Mỗi người chỉ có một key cá nhân đang hoạt động.
- appship coi `issuer_id` để trống là key cá nhân (`doctor` in dòng xác nhận).
- **Chưa kiểm chứng** với key cá nhân thật, xem [roadmap.md](roadmap.md).

API key chỉ dùng để **đẩy** lên store, không ký được app. Phần ký (certificate và provisioning profile) xem [signing.md](signing.md).

## Android: Google Play service account

1. Vào [Google Cloud Console](https://console.cloud.google.com), tạo hoặc chọn một project.
2. **APIs & Services → Library**, bật **Google Play Android Developer API**.
3. **IAM & Admin → Service Accounts → Create service account.** Không cần gán role GCP.
4. Mở service account vừa tạo → **Keys → Add key → JSON** để tải file JSON.
5. Vào [Play Console](https://play.google.com/console) → **Users and permissions → Invite new users**:
   - Email: `client_email` trong file JSON (dạng `xxx@project.iam.gserviceaccount.com`).
   - Quyền cho app: **Release apps to testing tracks**, **Release to production…**, **Manage store presence** (để đẩy metadata). Cũng có thể cấp ở mức account.
6. Đợi vài phút để quyền có hiệu lực. Có khi mất đến 24 giờ với account mới.

## Lưu key ở đâu?

Với mỗi trường, appship lấy giá trị từ nguồn **đầu tiên tìm thấy** theo thứ tự:

### 1. Biến môi trường (CI)

| Biến | Nội dung |
|---|---|
| `APPSHIP_ASC_KEY_ID` | Key ID |
| `APPSHIP_ASC_ISSUER_ID` | Issuer ID. Bỏ trống nếu dùng API key cá nhân |
| `APPSHIP_ASC_KEY_PATH` | Đường dẫn file `.p8` |
| `APPSHIP_ASC_KEY` | *Nội dung* file `.p8` (plain hoặc base64). Được ghi ra file tạm, quyền 600, xoá khi chạy xong |
| `APPSHIP_APPLE_ID` | Apple ID email |
| `APPSHIP_PLAY_JSON_PATH` | Đường dẫn service account JSON |
| `APPSHIP_PLAY_JSON` | *Nội dung* JSON (plain hoặc base64) |
| `APPSHIP_PROFILE` | Ghi đè `credentials.profile` |

### 2. Khai báo trong `release/release.yml`

```yaml
credentials:
  ios:
    key_id: ABC123DEFG
    issuer_id: 69a6de7a-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # bỏ dòng này nếu là API key cá nhân
    key_path: release/keys/AuthKey_ABC123DEFG.p8
    apple_id: you@example.com
  android:
    json_key_path: release/keys/play-service-account.json
```

Đường dẫn tính từ thư mục gốc dự án. `release/keys/*` đã được gitignore. Key ID và Issuer ID không phải bí mật, commit được.

### 3. Profile (khuyến nghị khi nhiều dự án dùng chung một tài khoản)

```bash
appship credentials add my-company \
  --asc-key ~/Downloads/AuthKey_ABC123DEFG.p8 --asc-key-id ABC123DEFG --asc-issuer-id 69a6de7a-… \
  --apple-id you@example.com \
  --play-json ~/Downloads/play-service-account.json

appship credentials list
appship credentials remove my-company
```

Key cá nhân (không có Issuer ID): bỏ `--asc-issuer-id`.

Lệnh này copy key vào `~/.appship/credentials/my-company/` với quyền 600. Dự án chỉ cần khai báo:

```yaml
credentials:
  profile: my-company
```

Có thể trộn các nguồn. Ví dụ dùng profile cho Android nhưng ghi đè key iOS bằng biến môi trường trên CI.

Khi đã có `profile`, các giá trị mẫu do `init` sinh ra trong `release.yml` (`TODO`, hoặc đường dẫn `release/keys/...` chưa có file) không che profile: appship bỏ qua chúng và lấy từ profile. Bạn không cần xoá khối `credentials.ios` / `credentials.android` mẫu, chỉ cần thêm dòng `profile:`. Giá trị thật (đường dẫn tồn tại, key id đã điền) vẫn được ưu tiên hơn profile.

## Chia sẻ key cho team

- **Không** gửi file key qua chat hay email.
- Nên dùng một trong các cách:
  - Password manager có CLI (1Password `op`, Bitwarden `bw`), mỗi người tự `appship credentials add`.
  - Mã hoá bằng [sops](https://github.com/getsops/sops) hoặc [age](https://github.com/FiloSottile/age) nếu buộc phải để trong repo.
  - Trên CI: lưu trong secrets và dùng biến `APPSHIP_ASC_KEY` / `APPSHIP_PLAY_JSON`.
- Lệnh `appship doctor` báo lỗi nếu file `.p8`, `.jks`, `service-account*.json` hoặc bất kỳ file nào trong `release/keys/` bị git track.

## Lỡ commit key thì làm gì?

1. **Thu hồi key ngay**:
   - iOS: App Store Connect → Integrations → Revoke.
   - Android: Cloud Console → Service account → Keys → Delete.
2. Tạo key mới và cập nhật profile hoặc secrets.
3. `git rm --cached <file>`. Key vẫn còn trong lịch sử git, nên bước 1 mới là bước quan trọng.
