# Chạy trên CI

Nguyên tắc:

- Key được truyền qua **secrets** vào biến môi trường `APPSHIP_*`.
- Mọi lệnh ghi lên store phải kèm `--yes`.
- Luôn chạy `appship doctor` trước.

## GitHub Actions

Mẫu đầy đủ: [`examples/github-actions.yml`](../examples/github-actions.yml). Copy vào `.github/workflows/release.yml` của dự án.

Secrets cần tạo trong repo (Settings → Secrets and variables → Actions):

| Secret | Giá trị |
|---|---|
| `APPSHIP_ASC_KEY_ID` | Key ID |
| `APPSHIP_ASC_ISSUER_ID` | Issuer ID |
| `APPSHIP_ASC_KEY` | `base64 -i AuthKey_XXX.p8` |
| `APPSHIP_PLAY_JSON` | `base64 -i play-service-account.json` |
| Signing iOS | Tuỳ cách ký: `MATCH_PASSWORD` + `MATCH_GIT_BASIC_AUTHORIZATION` nếu dùng match |
| Signing Android | Keystore base64 + mật khẩu, tuỳ cấu hình Gradle |

## Lưu ý

- **iOS phải build trên runner macOS.** Runner Linux chỉ dùng được cho `upload`/`submit` nếu `.ipa` được build ở job khác.
- `apple_id` (tạo app, App Privacy) **không chạy được trên CI** vì cần 2FA. Hãy làm các bước này ở máy local một lần.
- Nếu cần pin phiên bản fastlane, dùng Gemfile và đặt `APPSHIP_FASTLANE="bundle exec fastlane"`.
- Các lệnh đều có `--dry-run`, dùng được để thử pipeline mà không đẩy gì lên store.
