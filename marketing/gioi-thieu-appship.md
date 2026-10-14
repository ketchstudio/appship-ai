# Code app xong rồi, giờ đưa lên store kiểu gì?

Bạn là dev web, BE hay FE, hoặc là một viber coder quen "chat với AI là ra app". Vài buổi tối là bạn đã có app Flutter hay React Native chạy ngon trên máy, rồi bạn bấm "publish".

Đến đây thì mọi thứ chậm hẳn lại. App Store Connect hỏi age rating, App Privacy, export compliance, thông tin liên hệ cho reviewer. Google Play Console hỏi Data safety, content rating, target audience, có quảng cáo hay không. Bên nào cũng đòi screenshot đúng từng pixel, mô tả không quá số ký tự, key `.p8`, service account JSON. Cả hai console lại hay đổi giao diện. Cuối cùng phần lâu nhất không phải viết app mà là đưa app lên store.

**appship** được làm ra để giải quyết đúng chỗ này.

## appship là gì?

Một CLI Node chạy trên nền [fastlane](https://fastlane.tools), dùng để release app lên **App Store** và **Google Play** từ **một file config duy nhất**. Repo của bạn chỉ có thêm thư mục `release/`. Bạn không phải viết hay chép Fastfile cho từng dự án.

```bash
npm i -g appship-ai

appship init            # một lần cho mỗi dự án
appship doctor          # kiểm tra mọi thứ trước khi release
appship first-release   # lần đầu lên store
appship upload --build  # build rồi đẩy lên TestFlight / Google Play
appship submit          # iOS: gửi App Review · Android: lên production
```

## Các chức năng chính

**1. `appship init`: tự nhận diện dự án**
Nhận ra Flutter, React Native, Cocos Creator hoặc native. Tự đọc bundle id và package name, tạo sẵn `release.yml`, file câu hỏi, mẫu metadata, và thêm key vào `.gitignore`.

**2. Trả lời câu hỏi của store một lần**
Mọi câu trả lời nằm trong `release/questionnaire.yml`. Phần nào API cho phép (age rating, App Privacy, export compliance, content rights, liên hệ reviewer) thì appship tự điền lên App Store. Phần store bắt làm tay (Data safety, content rating của Google Play…) thì appship viết ra `CHECKLIST.md` có sẵn câu trả lời của bạn, chỉ việc copy vào console.

**3. `appship doctor`: bắt lỗi trước khi store bắt**
Kiểm tra giới hạn ký tự, chữ placeholder còn sót, kích thước và số lượng ảnh, ảnh PNG có alpha, mã ngôn ngữ sai, key thiếu hoặc sai định dạng, và cả key lỡ commit lên git. Sửa đến khi hết ✗ là sẵn sàng.

**4. Upload và submit bằng một lệnh**
- iOS: build `.ipa` → TestFlight → App Review.
- Android: `.aab` → internal / alpha / beta / production, có staged rollout (`--rollout 20%`), `promote` giữa các track.
- `appship status` cho biết app đang live, đang review hay đang chờ, build TestFlight mới nhất, version code từng track.

**5. Listing và screenshot dạng file**
`appship metadata push/pull` đồng bộ mô tả và ảnh cho nhiều ngôn ngữ. App đã live thì `pull` về trước, sửa trong editor rồi `push` lên.

**6. Key được giữ an toàn**
Lưu key theo profile trong `~/.appship` (quyền 600), để trong `release/keys/` đã gitignore, hoặc dùng biến môi trường cho CI. Có sẵn workflow GitHub Actions mẫu. Không phải chủ tài khoản Apple? `appship signing import` dùng được file `.p12` và provisioning profile mà chủ tài khoản gửi cho bạn.

**7. Làm việc cùng AI agent**
`init` cài sẵn ba skill cho Claude Code, Codex và Antigravity:
- `release-notes`: đọc `git log`, viết release notes cho mọi ngôn ngữ và giữ trong giới hạn ký tự của store.
- `store-screenshots`: chụp màn hình từ Simulator/emulator, thêm tiêu đề đã dịch, render đúng kích thước iPhone 6.9", iPad 13", Play 1080x1920.
- `app-content`: đọc dependency, permission và code để điền `questionnaire.yml`, giữ câu trả lời hai store khớp nhau.

Chỉ cần dán một prompt dựng sẵn vào agent, nó sẽ cài appship, chạy `init`, điền nội dung store và chạy `doctor` đến khi pass. Skill không bao giờ tự đẩy gì lên store.

**8. An toàn khi thử**
Mọi lệnh ghi lên store đều hỏi xác nhận trước. Thêm `--dry-run` để xem chính xác những gì sẽ được gửi đi trước khi gửi thật.

## Dành cho ai?

- Dev web/BE/FE lần đầu làm app mobile, chưa muốn học hết fastlane và hai console.
- Viber coder build app bằng AI và muốn phần publish cũng chạy bằng AI.
- Indie dev hoặc studio có nhiều app và không muốn mỗi repo một bản Fastfile.

## Thử ngay

```bash
brew install fastlane
npm i -g appship-ai
cd my-app && appship init && appship doctor
```

Cần Node 22+ và fastlane. Build iOS cần macOS, còn Android chạy được cả trên Linux.

> appship đang ở **v0.2.0**, mã nguồn mở (MIT). Code đã có test và dry-run nhưng chưa chạy thật với store. Nên bắt đầu bằng `--dry-run` và các lệnh chỉ đọc như `appship status`.

🌐 https://appship.ketchsoft.com · 📦 `npm i -g appship-ai` · ⭐ github.com/ketchstudio/appship-ai
