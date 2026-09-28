# Các lệnh

Tuỳ chọn chung:

| Tuỳ chọn | Tác dụng |
|---|---|
| `--ios` / `--android` | Chỉ chạy cho một platform. Mặc định chạy mọi platform có trong `release.yml` |
| `-y, --yes` | Bỏ qua câu hỏi xác nhận. **Bắt buộc trên CI** với các lệnh ghi lên store |
| `--dry-run` | In lane fastlane và dữ liệu sẽ gửi (mật khẩu bị che), không gọi store |

Lệnh có thể chạy ở bất kỳ thư mục con nào của dự án. Tool tự tìm `release/release.yml` ở các thư mục cha.

Chi tiết từng lệnh: `appship <lệnh> --help`.

## `appship init`

Tạo `release/` trong dự án hiện tại.

```bash
appship init                                   # hỏi từng bước
appship init --yes --name "Word Bank"          # dùng giá trị tự nhận diện
appship init --yes --platforms android --package-name com.x.y --framework none
appship init --force                           # tạo lại release.yml và questionnaire.yml (giữ metadata)
```

## `appship doctor`

Kiểm tra mọi thứ mà không gọi store:

- Node và fastlane
- Config hợp lệ
- Key có tồn tại và đúng định dạng không, lấy từ nguồn nào
- Key có bị git track không
- Artifact có tồn tại và đã cũ chưa
- Metadata: giới hạn ký tự, URL, `TODO`, kích thước ảnh
- Questionnaire đã đủ chưa

Thoát với mã 1 nếu có lỗi, nên dùng được làm bước đầu tiên trong CI.

```bash
appship doctor --skip-artifacts --skip-screenshots
```

## `appship credentials`

```bash
appship credentials add <profile> [--asc-key f.p8 --asc-key-id ID --asc-issuer-id UUID --apple-id email --play-json f.json]
appship credentials list
appship credentials remove <profile> [--yes]
```

## `appship build`

Chạy `build_command` của từng platform.

## `appship upload`

- iOS: upload `.ipa` lên **TestFlight**.
- Android: upload `.aab` lên track.

```bash
appship upload                          # mọi platform, artifact mới nhất
appship upload --build                  # build trước
appship upload --android --track alpha
appship upload --android --track production --rollout 20%   # hỏi xác nhận
appship upload --ios --groups "QA,Beta" --changelog "Test the new quiz"
appship upload --ios --artifact ~/Desktop/App.ipa
```

## `appship metadata [push|pull]`

```bash
appship metadata                  # push: text + screenshots (hỏi xác nhận vì ghi đè listing trên store)
appship metadata --no-screenshots
appship metadata pull             # tải listing hiện tại về release/ (dùng cho app đã có)
```

Nếu validate lỗi thì lệnh push dừng lại. Dùng `--force` để bỏ qua.

## `appship submit`

- **iOS:** đẩy metadata, chọn build (mới nhất hoặc `--build-number`), trả lời export compliance và content rights, rồi gửi **App Review**.
- **Android:** promote release từ `android.track` (hoặc `--from`) lên **production**. Google vẫn review trước khi app lên store.

```bash
appship submit
appship submit --ios --app-version 1.3.0 --build-number 57
appship submit --android --from alpha --rollout 10%
```

## `appship promote` (Android)

```bash
appship promote --from internal --to alpha
appship promote --from production --to production --rollout 50%    # tăng rollout
```

## `appship status`

- iOS: version đang live, đang review, chờ phát hành, đang editable, và build TestFlight mới nhất.
- Android: version code và release name trên từng track.

## `appship first-release`

```bash
appship first-release --create-app
```

1. iOS:
   - Tạo app. Chỉ chạy khi có `--create-app`, cần `apple_id`, có thể hỏi 2FA.
   - Đẩy metadata.
   - Upload App Privacy nếu có `apple_id`.
2. Android: in hướng dẫn các bước bắt buộc làm tay.
3. Ghi `release/CHECKLIST.md`.

## `appship checklist`

Tạo lại `release/CHECKLIST.md` từ `questionnaire.yml`. Nên commit file này để cả team cùng xem.
