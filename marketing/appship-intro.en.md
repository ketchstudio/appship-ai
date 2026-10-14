# Your app runs fine locally. So why are you stuck at "Publish"?

You're a web developer, backend or frontend, or a vibe coder who builds apps by chatting with an AI. A few evenings later you have a Flutter or React Native app running nicely on your machine. Then you hit "publish".

That's where everything slows down. App Store Connect asks about age rating, App Privacy, export compliance and a contact for the reviewer. Google Play Console asks about Data safety, content rating, target audience and whether you show ads. Both want screenshots at exact pixel sizes, descriptions under a character limit, a `.p8` key or a service account JSON. And both consoles keep changing. The slowest part turns out not to be writing the app but getting it onto the stores.

**appship** was built for exactly this part.

## What is appship?

A Node CLI, built on fastlane, that releases your app to the **App Store** and **Google Play** from **one config file**. Your repo only gains a `release/` folder. No Fastfile to write or copy into every project.

```bash
npm i -g appship-ai

appship init            # once per project
appship doctor          # check everything before releasing
appship first-release   # first time on the stores
appship upload --build  # build, then push to TestFlight / Google Play
appship submit          # iOS: send for App Review · Android: promote to production
```

## What it does

**1. `appship init`: detects your project**
Recognizes Flutter, React Native, Cocos Creator or native. Reads your bundle id and package name, creates `release.yml`, the questionnaire, metadata templates, and adds your keys to `.gitignore`.

**2. Answer the store questions once**
All your answers live in `release/questionnaire.yml`. Whatever the APIs allow (age rating, App Privacy, export compliance, content rights, reviewer contact), appship fills in on the App Store for you. For what the stores keep manual (Google Play's Data safety, content rating…), appship writes a `CHECKLIST.md` with your answers ready to paste into the console.

**3. `appship doctor`: catch problems before the stores do**
Checks character limits, leftover placeholder text, image sizes and counts, PNGs with alpha, invalid locale codes, missing or malformed keys, and keys accidentally committed to git. Fix until there's no ✗ and you're ready.

**4. Upload and submit with one command**
- iOS: build the `.ipa` → TestFlight → App Review.
- Android: `.aab` → internal / alpha / beta / production, with staged rollout (`--rollout 20%`) and `promote` between tracks.
- `appship status` shows whether your app is live, in review or pending, the latest TestFlight build, and version codes per track.

**5. Listing and screenshots as files**
`appship metadata push/pull` syncs descriptions and screenshots across languages. Already live? `pull` first, edit in your editor, then `push`.

**6. Keys handled safely**
Store keys in a named profile under `~/.appship` (mode 600), in a gitignored `release/keys/`, or in environment variables for CI. A ready-made GitHub Actions workflow is included. Not the Apple account owner? `appship signing import` works from the `.p12` and provisioning profiles the owner sends you.

**7. Works with your AI agent**
`init` installs three skills for Claude Code, Codex and Antigravity:
- `release-notes`: reads `git log` and writes release notes in every language, within the store limits.
- `store-screenshots`: captures screens from the iOS Simulator or an Android emulator, adds a translated headline, and renders exact sizes for iPhone 6.9", iPad 13" and Play 1080x1920.
- `app-content`: reads your dependencies, permissions and code to fill in `questionnaire.yml`, keeping both stores consistent.

Paste one ready-made prompt into your agent and it installs appship, runs `init`, fills in the store content and runs `doctor` until it passes. The skills never push anything to a store on their own.

**8. Safe to try**
Every command that writes to a store asks for confirmation first. Add `--dry-run` to see exactly what would be sent before anything is sent.

## Who is it for?

- Web, backend and frontend developers shipping their first mobile app who don't want to learn fastlane and two consoles first.
- Vibe coders who build apps with AI and want publishing to run through AI too.
- Indie developers and studios with several apps who don't want a separate Fastfile in every repo.

## Try it

```bash
brew install fastlane
npm i -g appship-ai
cd my-app && appship init && appship doctor
```

Requires Node 22+ and fastlane. iOS builds need macOS; Android also works on Linux.

> appship is at **v0.2.0** and open source (MIT). The code is covered by tests and dry-runs but hasn't been run against the live stores yet. Start with `--dry-run` and read-only commands such as `appship status`.

🌐 https://appship.ketchsoft.com · 📦 `npm i -g appship-ai` · ⭐ github.com/ketchstudio/appship-ai
