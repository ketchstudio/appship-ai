# Changelog

## 0.1.0 — 2026-09-28 (chưa phát hành)

Bản đầu tiên.

- CLI `appship` gồm các lệnh: `init`, `doctor`, `credentials`, `build`, `upload`, `metadata`, `submit`, `promote`, `status`, `first-release`, `checklist`.
- Fastfile dùng chung cho iOS (TestFlight, deliver, produce, App Privacy) và Android (supply).
- Key lấy theo thứ tự: biến môi trường → `release.yml` → profile trong `~/.appship`.
- `questionnaire.yml` cho các câu hỏi của store, cùng `CHECKLIST.md` cho các bước phải làm tay.
- Tên package: `appship-ai`. Lệnh: `appship`, kèm alias `appship-ai`.
- Trang giới thiệu tĩnh trong `website/` (HTML, CSS, JS thuần, có animation nhẹ), kèm trang hướng dẫn tích hợp `website/docs.html`. Chỉ hướng dẫn cài qua npm.
- License MIT, bản quyền Ketchsoft. `package.json` có thêm `author` (Ketchsoft), `repository`, `homepage`, `bugs`. README, website và tài liệu ghi "powered by Ketchsoft", không còn tên hay email cá nhân.
- README tiếng Anh; bản tiếng Việt chuyển sang `docs/README.vi.md`.
