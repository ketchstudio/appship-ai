---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Code xong app rồi? appship lo phần đưa lên App Store và Google Play."
destination: youtube
aspect: 1920x1080
language: en
audience: "Viber coder và dev web BE/FE muốn làm app mobile nhưng bí ở khâu publish"
length: 30s
angle: problem-solution
---

## Intent

Video giới thiệu ~30s cho appship-ai (CLI release app lên App Store / Google Play, chạy trên fastlane).
Kịch bản: bạn là viber coder hoặc dev BE/FE, app chạy ngon trên máy nhưng kẹt ở khâu publish
(questionnaire, screenshot, key, hai console) → appship là lời giải. Nhấn mạnh các chức năng.
Tempo và tốc độ nhanh: cắt nhanh, chữ đập mạnh.

## Customizations

- Render hoàn toàn offline. Không voice. Nhạc nền 120 BPM + SFX tổng hợp offline bằng `scripts/make-audio.py` (stdlib Python), chuẩn hoá -14 LUFS bằng ffmpeg, gắn vào `index.html` là `<audio id="sound-mix">`. (Bản đầu không có tiếng; người dùng yêu cầu thêm.)
- Bản tiếng Anh của `../intro-video` (cùng hình, nhịp, âm thanh). Chữ trên màn hình tiếng Anh; chỉ thay text trong `compositions/frames/*.html`.
- Dùng màu thương hiệu của website: navy #0b1826 + vàng signal #ffc530, font Archivo + IBM Plex Mono.

## Notes

- appship đang ở v0.2.0, chưa chạy thật với store: không hứa hẹn quá đà.
- Không dùng logo Apple/Google; gọi bằng chữ "App Store", "Google Play".
