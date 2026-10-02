# Prompt dựng sẵn cho AI agent

Thay vì tự đọc hết hướng dẫn, bạn có thể dán một prompt dưới đây vào AI coding agent (Claude Code, Codex, Antigravity, Cursor…) đang mở **ở thư mục gốc của dự án**. Agent sẽ cài, cấu hình và kiểm tra appship, rồi dừng lại hỏi bạn ở những bước cần bạn quyết định.

Khác với [skill](skills.md): skill chỉ có sau khi dự án đã `appship init`, còn prompt dùng được từ đầu, khi máy chưa cài gì. Prompt "Setup dự án" sẽ cài skill rồi dùng chúng để điền nội dung.

appship không gọi AI nào. Prompt chỉ là văn bản để bạn copy; chi phí AI tính theo gói của agent bạn dùng.

Các prompt viết bằng tiếng Anh để agent nào cũng hiểu như nhau. Dòng cuối mỗi prompt bảo agent trả lời bằng ngôn ngữ bạn dùng, nên bạn cứ nhắn tiếng Việt.

## Luật an toàn có sẵn trong mọi prompt

- Agent **không** chạy lệnh ghi lên store (`upload`, `metadata` push, `submit`, `promote`, `first-release`, `signing import`) khi bạn chưa yêu cầu. Khi được yêu cầu, agent chạy `--dry-run` trước và chờ bạn đồng ý.
- Terminal của agent thường không trả lời được câu hỏi xác nhận của appship, nên lệnh sẽ báo cần `--yes`. Agent chỉ thêm `--yes` **sau khi** bạn đã duyệt kết quả `--dry-run` trong cuộc trò chuyện.
- Agent không mở, in, copy hay commit file key (`*.p8`, `*.p12`, `*.jks`, service account JSON). Bạn tự chạy `appship credentials add` trong terminal của mình.
- Agent không tự commit hay push.

Dù vậy, hãy đọc lệnh agent xin chạy trước khi cho phép. Đừng bật chế độ tự chấp nhận mọi lệnh.

## 1. Setup dự án

Dùng một lần cho mỗi dự án, kể cả khi máy chưa cài fastlane hay appship.

```text
Set up appship-ai in this project so I can release it to the App Store and Google Play.
appship is a CLI that wraps fastlane. Guide: https://appship.ketchsoft.com/docs.html

1. Check node (22+), fastlane and appship (`appship --version`). Tell me what is missing and ask before installing anything globally (`brew install fastlane`, `npm i -g appship-ai`).
2. Run `appship init --yes --agents <you>` at the project root, where <you> is claude, codex or antigravity (the agent you are; use claude if none fits). Compare release/release.yml with the project (build_command, artifact paths, bundle id, package name), fix what is wrong and tell me what you changed.
3. Store keys: tell me what I need (App Store Connect API key, Google Play service account JSON) and how to create them, following "Get store keys" in the guide. I will run `appship credentials add <profile>` in my own terminal. Then set credentials.profile in release.yml.
4. Fill the store content with the skills that init installed: app-content for release/questionnaire.yml, the listing text in release/*/metadata, then store-screenshots. If the skills are not loaded in this session, read their SKILL.md files in .claude/skills/ or .agents/skills/ and follow them. If the app is already live, ask me whether to run `appship metadata pull` first. Ask me for anything the code cannot tell you; leave contacts, demo accounts and passwords as TODO until I give them.
5. Run `appship doctor` and fix until there is no ✗. List the remaining warnings (!).
6. Finish with a short summary: what is done, what I still have to do by hand, and the next command to run.

Rules:
- Never run a command that writes to a store (upload, metadata push, submit, promote, first-release, signing import) unless I ask. Then run it with --dry-run first and wait for my OK. Add --yes only after I approved the dry run in this chat.
- Never open, print, copy or commit key files (*.p8, *.p12, *.jks, *.keystore, service account JSON) or anything in release/keys/.
- Do not commit or push.
- Reply in the language I write in.
```

## 2. Setup CI (GitHub Actions)

Dùng sau khi dự án đã có `release/release.yml`. Chi tiết về CI: [ci.md](ci.md).

```text
Set up GitHub Actions to release this project with appship-ai. The project already has release/release.yml.
Guide: https://appship.ketchsoft.com/docs.html#ci

1. Start from https://raw.githubusercontent.com/ketchstudio/appship-ai/main/examples/github-actions.yml. Save it as .github/workflows/release.yml and adapt it to this project: platforms, toolchain setup, build steps, Android keystore, and the iOS signing method in use (fastlane match, files from the account owner with `appship signing import --keychain`, or automatic signing).
2. Keep `appship doctor` as the first appship step. Store-writing steps need --yes in CI; keep submit behind the manual `submit` input.
3. List every secret I must add in Settings → Secrets and variables → Actions, with the command that produces each value (for example `base64 -i AuthKey_XXXX.p8 | pbcopy`). I add the secrets myself. Never read or print key files and never write a key value into a file.
4. Creating the iOS app and uploading App Privacy need an Apple ID with 2FA and cannot run in CI. If this project still needs them, tell me to run them locally once.
5. Show me the final workflow and the list of secrets. Do not commit or push until I say so.

Reply in the language I write in.
```

## 3. Mỗi lần release

```text
Prepare a new release of this project with appship-ai (already set up in release/).

1. Find the current version and build number (pubspec.yaml, build.gradle, the Xcode project or Info.plist, package.json: whatever this project uses) and read the git log since the last tag. Propose the next version and build number, and change them once I agree.
2. Write the release notes for every locale with the release-notes skill (read its SKILL.md in .claude/skills/ or .agents/skills/ if it is not loaded).
3. Run `appship doctor` and fix the errors.
4. Run `appship upload --build --dry-run`, show me what would be sent, and stop.

When I approve, run `appship upload --build`. When I later ask to submit, run `appship submit --dry-run` first and wait for my OK again. Add --yes only after I approved the dry run in this chat. Never open or print key files. Do not commit or push unless I ask.

Reply in the language I write in.
```

## 4. Ký iOS khi không phải chủ tài khoản

Dùng khi bạn không phải Account Holder hay Admin và owner đưa cho bạn file `.p12` và `.mobileprovision`. Chi tiết: [signing.md](signing.md).

```text
Set up iOS code signing for this project with appship-ai. I am not the account owner; the owner gave me a .p12 (Apple Distribution certificate) and App Store .mobileprovision files.
Guide: https://appship.ketchsoft.com/docs.html#not-owner

1. Ask me where the files are. They must be inside release/keys/ (gitignored); tell me to move them there if they are not. Do not open, print or copy them yourself.
2. Add an ios.signing block to release/release.yml (style: manual, certificate, profiles: one per bundle id, including extensions).
3. Change ios.build_command so the build uses "$APPSHIP_EXPORT_OPTIONS" (for Flutter: --export-options-plist="$APPSHIP_EXPORT_OPTIONS"; for xcodebuild/gym: the matching export options flag).
4. Run `appship signing import --dry-run` and show me the result. I will run the real import in my own terminal, because it asks for the .p12 password.
5. Run `appship doctor` and explain every signing error or warning (profile type, expiry, team, bundle id, certificate in the keychain).

Never commit anything in release/keys/. Do not commit or push unless I ask. Reply in the language I write in.
```

## Cập nhật prompt (cho người phát triển appship)

Bản gốc của các prompt là file này. Prompt còn được chép ở website và README; danh sách chỗ phải sửa theo nằm trong [development.md](development.md#prompt-dựng-sẵn-cho-ai-agent).

Prompt chỉ được nhắc tới lệnh, cờ và đường dẫn có thật trong code (`src/cli.js`) và anchor có thật trên website. Đổi tên lệnh hay anchor thì phải sửa cả prompt.
