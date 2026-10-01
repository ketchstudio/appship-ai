# Thiết kế và các quyết định

Tài liệu này ghi lại **tại sao** appship được làm như hiện tại: mục tiêu, giới hạn của store, và các quyết định đã chốt. Đọc file này trước khi thay đổi kiến trúc.

## 1. Mục tiêu

Một tool tự động upload và release app lên **Google Play** và **App Store**. Người dùng chỉ cần:

1. Trỏ đúng tới các tài nguyên (build, metadata, screenshots).
2. Gắn key vào từng dự án.
3. Gõ lệnh.

Các chức năng cần có:

- Release lần đầu
- Trả lời câu hỏi của store
- Submit
- Update app

## 2. Vì sao chọn fastlane làm lõi

fastlane đã giải quyết sẵn các phần khó nhất:

| Công cụ | Việc nó làm |
|---|---|
| `deliver` | Metadata, screenshots, submit iOS |
| `pilot` | TestFlight |
| `supply` | Google Play |
| `produce` | Tạo app iOS |
| `spaceship` | Client cho App Store Connect API |
| `match` | Ký app iOS |

appship **không viết lại** các công cụ này. Nó thêm lớp cấu hình, kiểm tra, quản lý key và checklist lên trên.

## 3. Giới hạn của store: không phải mọi thứ đều tự động được

Apple và Google cố ý để một số bước phải làm tay, nhất là ở lần release đầu. Tool chia các bước thành 3 loại:

- **Tự động hoàn toàn:** tool làm luôn.
- **Tự động một phần:** cần Apple ID đăng nhập (có 2FA), nên không chạy được trên CI.
- **Không có API:** tool in checklist kèm câu trả lời để người dùng bấm theo.

| Chức năng | iOS | Android |
|---|---|---|
| Tạo app lần đầu | `produce`, cần Apple ID vì API key không tạo được app | **Không có API.** Phải tạo trên Play Console |
| Upload build đầu tiên | Tự động | Nên upload AAB đầu tiên **bằng tay**. Tài khoản cá nhân mới cần closed test với 12 tester trong 14 ngày |
| Metadata, screenshots | Tự động | Tự động |
| Age rating, export compliance, content rights, thông tin cho reviewer | Tự động | n/a |
| App Privacy | `upload_app_privacy_details_to_app_store`, cần Apple ID | n/a |
| Content rating (IARC), Data safety, Target audience, Ads, App access | n/a | **Không có API**, dùng checklist |
| Submit | `deliver submit_for_review` | Promote track lên production |
| Update app | Tự động | Tự động |
| Trả lời review của user | Có API, **chưa làm** | Có API, **chưa làm** |
| Trả lời khi app bị reject | Không có API | Không có API |

Hệ quả thiết kế: "trả lời câu hỏi của store" được làm theo kiểu **khai báo một lần trong `questionnaire.yml`**. Phần nào có API thì tool tự điền, phần còn lại được sinh thành `release/CHECKLIST.md`.

## 4. Mô hình sử dụng

| Việc | Tần suất |
|---|---|
| Cài CLI và fastlane (global, **không** cài vào từng dự án) | 1 lần mỗi máy |
| Thêm key (`appship credentials add`) | 1 lần mỗi tài khoản store |
| `appship init` | 1 lần mỗi dự án |
| Sửa metadata và gõ lệnh | Mỗi lần release |

Mỗi dự án chỉ có thêm thư mục `release/`. **Dự án không có Fastfile riêng.** Fastfile nằm trong tool và được copy vào `release/.appship/fastlane-run/` ở mỗi lần chạy, nên khi sửa tool thì mọi dự án đều được cập nhật.

## 5. Các quyết định kiến trúc

1. **CLI Node kết hợp một Fastfile dùng chung.**
   - Node lo phần config (YAML), validate, key, câu hỏi tương tác và checklist.
   - Ruby chỉ nhận một file `context.json` đã resolve sẵn (đường dẫn tuyệt đối, key).
   - Nhờ vậy lane trong Fastfile không phải tự parse config.
2. **Tool không build app.** Nó chạy `build_command` (hook) rồi lấy artifact theo glob. Vì vậy dùng được cho Flutter, React Native, Cocos, native, và tool cũng không ký app thay người dùng.
   - Với người không phải chủ tài khoản, tool **kiểm tra** file signing (`doctor`), **cài** chúng lên máy (`signing import`) và **truyền** cách ký cho `build_command` qua `ExportOptions.plist`. Việc archive và export vẫn do công cụ build làm. Chi tiết: [signing.md](signing.md).
   - Tool không hỗ trợ upload bằng Apple ID (không API key): cách này cần đăng nhập 2FA tương tác, không chạy được trên CI. Ai không có API key thì tải `.ipa` bằng tay (Transporter / Xcode).
3. **Key được lấy theo thứ tự:** biến môi trường → `release.yml` → profile.
   - Biến môi trường dùng cho CI. Có thể truyền nội dung key dạng base64, tool ghi ra file tạm với quyền 600.
   - Khai báo trong `release.yml` phù hợp khi key nằm trong `release/keys/` của dự án (đã gitignore).
   - Profile (`~/.appship/credentials/<tên>/`) phù hợp khi nhiều dự án dùng chung một tài khoản.
4. **Ưu tiên App Store Connect API key hơn Apple ID.** Apple ID chỉ dùng cho tạo app và App Privacy, vì phiên đăng nhập hết hạn và cần 2FA.
   - `issuer_id` là tuỳ chọn: API key **cá nhân** (người không phải owner tự tạo) không có Issuer ID. Nếu để trống, tool coi đó là key cá nhân.
5. **Quy tắc an toàn:**
   - `init` tự thêm `release/keys/*` và `release/.appship/` vào `.gitignore`.
   - `doctor` báo lỗi nếu có key bị git track.
   - `context.json` (có thể chứa mật khẩu tài khoản demo) có quyền 600 và bị xoá ngay khi lane chạy xong.
   - `--dry-run` che mọi trường mật khẩu.
6. **Hỏi xác nhận trước mọi thao tác ghi lên store** (submit, đẩy lên production, ghi đè metadata). Ở chế độ không tương tác, phải thêm `--yes` rõ ràng.
7. **`doctor` là bắt buộc.** Nó phát hiện lỗi trước khi gọi store: giới hạn ký tự, URL, `TODO`, kích thước ảnh, key, artifact cũ.
8. **Tên tham số fastlane được đối chiếu với mã nguồn fastlane 2.232.2**, không viết theo trí nhớ. Khóa age rating dùng tên của App Store Connect API (bộ câu hỏi mới năm 2025: `ageAssurance`, `lootBox`, `messagingAndChat`…).

## 6. Đặt tên và phát hành

- Tên npm package: **`appship-ai`**. Tên `appship` đã có người dùng.
- Lệnh chính: **`appship`**. Có thêm alias `appship-ai` để `npx appship-ai` chạy được.
- **Mã nguồn mở, license MIT.** Lý do: publish lên npm thì code vốn đã public, và người dùng phải đưa key store cho tool nên họ cần đọc được code để tin tưởng. Nếu sau này có tính năng AI trả phí, tính năng đó sẽ là dịch vụ riêng (open-core); phần CLI vẫn mở.
- Repo: `ketchstudio/appship-ai`, công khai, trùng tên package npm. Website https://appship.ketchsoft.com và repo trỏ lẫn nhau.
- **Sản phẩm của Ketchsoft.** Bản quyền trong `LICENSE` và trường `author` trong `package.json` đứng tên Ketchsoft. README, website và tài liệu ghi "powered by Ketchsoft", không ghi tên hay email cá nhân.
- README ở gốc repo viết **tiếng Anh** vì đó là trang hiển thị trên npm và GitHub. Bản tiếng Việt ở `docs/README.vi.md`. Tài liệu chi tiết trong `docs/` vẫn viết tiếng Việt.
- Thứ tự phát hành:
  1. Chạy thật với store trên 1–2 dự án.
  2. Publish lên npm (tài khoản có bật 2FA).
  3. Làm Homebrew tap (tuỳ chọn).

## 7. Chiến lược tài liệu

- **Tool tự hướng dẫn trước, tài liệu sau.** Các cơ chế gồm:
  - `init` hỏi từng bước và tự nhận diện dự án.
  - Template có comment.
  - `doctor` báo lỗi kèm cách sửa.
  - `CHECKLIST.md` có sẵn câu trả lời.
  - `--help` cho từng lệnh.
- Tài liệu nằm trong repo (`docs/`) và viết bằng tiếng Việt. Thông báo của CLI dùng tiếng Anh.
- Hướng dẫn lấy key là phần **dễ lỗi thời nhất**, vì giao diện console hay đổi. Khi cập nhật phần này, ghi lại ngày.
- Nên viết thêm tài liệu dựa trên những chỗ thực sự bị vướng khi dùng thật (xem `roadmap.md`).
