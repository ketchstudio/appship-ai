---
name: store-screenshots
description: Create App Store and Google Play screenshots (and the Play icon and feature graphic) for an app released with appship, in every store language, at the exact pixel sizes each store accepts. Use when the user asks to make, capture, generate, frame, caption, translate, resize or fix store screenshots, marketing screenshots, the feature graphic or the Play store icon.
---

# Store screenshots for appship

appship uploads screenshots from plain folders. Your job is to fill those folders with correct images. Never upload anything.

| Store | Folder | What deliver / supply reads |
|---|---|---|
| App Store | `release/ios/screenshots/<locale>/` | Every PNG/JPG, sorted by file name. The device type comes from the pixel size. |
| Google Play | `release/android/metadata/<locale>/images/phoneScreenshots/` | Every PNG/JPG, sorted by file name. |
| Google Play | `release/android/metadata/<locale>/images/icon.png`, `featureGraphic.png` | One file each. |

Paths can be changed in `release/release.yml` (`ios.screenshots_path`, `android.metadata_path`); read them from there.

Keep the sources you work from in `release/screenshots-src/` (raw captures, the HTML template, captions). The stores never read that folder. Ask the user whether to commit it.

## Sizes (checked against fastlane 2.232.2)

**App Store** (`Deliver::AppScreenshot`), portrait or landscape, PNG or JPG, at most 10 per device size and locale:

| Device size | Accepted pixels (portrait) | Needed |
|---|---|---|
| iPhone 6.9" | 1320x2868, 1290x2796, 1260x2736 | **Yes** (or 6.5"). Make 1320x2868. Apple scales it down for smaller iPhones. |
| iPhone 6.5" | 1284x2778, 1242x2688 | Only if there is no 6.9" set |
| iPad 13" | 2064x2752, 2048x2732 | **Yes if the app runs on iPad** |
| iPad 11" | 1668x2388, 1640x2360, 1668x2420, 1488x2266 | Optional |

- The app runs on iPad when `TARGETED_DEVICE_FAMILY` in `ios/**/project.pbxproj` contains `2` (Flutter's default is `"1,2"`). If so, make an iPad 13" set too, or tell the user to remove iPad support.
- A 2048x2732 file counts as iPad 13" unless its name contains `app_ipad_pro_129` (then it is the old 12.9" 2nd generation).
- Do not put `_framed` in a file name. Once a folder has any `*_framed.png`, deliver uploads only those and skips the rest.
- Apple wants flattened RGB images: no transparency.

**Google Play** (`Supply::SCREENSHOT_TYPES`, `IMAGES_TYPES`):

| File | Size | Rules |
|---|---|---|
| `phoneScreenshots/*.png` | Make 1080x1920 (9:16) | 2 to 8 files. Each side 320 to 3840 px, long side at most 2x the short side. JPEG or 24-bit PNG, no alpha. |
| `icon.png` | 512x512 | 32-bit PNG (alpha allowed) |
| `featureGraphic.png` | 1024x500 | JPEG or 24-bit PNG, no alpha. Required. |
| `sevenInchScreenshots/`, `tenInchScreenshots/` | Optional | Same rules as phone screenshots |

A raw capture from a modern Android phone (for example 1080x2400, ratio 20:9) is **rejected** by Play. Put it inside a 1080x1920 frame instead (step 5).

Languages without their own images fall back to the default language on Play. On the App Store, a locale without screenshots also shows the primary locale's set, but `appship doctor` warns about it.

## Steps

1. **Read the project.** `release/release.yml`: `app.primary_locale`, which of `ios:` / `android:` exist, `upload_screenshots`, the `locales` lists. List the locale folders under `release/ios/metadata/` and `release/android/metadata/` (iOS and Play codes differ: `ja` vs `ja-JP`; never copy a folder name across). Check iPad support (above). List what already exists in the screenshot folders.
2. **Agree on the plan with the user before capturing.** Propose 4 to 6 screens that show the app in use, best feature first, and one short headline per screen in the primary locale (2 to 6 words, at most about 30 characters, two lines at most). Ask which style they want:
   - **Plain**: the raw screen only (iOS: the capture already has the right size; Android: still needs the 1080x1920 frame if the ratio is above 2:1).
   - **Captioned** (default): brand-colored background, headline at the top, the screen below with rounded corners. No device frame.
   Read brand colors and font from the app (Flutter `ThemeData`/`ColorScheme`, Android `colors.xml`/`themes.xml`, iOS asset catalog `AccentColor`, CSS variables). Ask if none are found.
3. **Capture the raw screens** into `release/screenshots-src/raw/<ios|android>/<locale>/01_<screen>.png`. Use what the project already has first: `fastlane snapshot` / `screengrab`, a Flutter `integration_test` that takes screenshots, or images the user gives you. Otherwise capture by hand:
   - **iOS Simulator** (needs Xcode): pick a 6.9" iPhone from `xcrun simctl list devices available` (iPhone 16 Pro Max or newer gives 1320x2868), boot it, install and launch the app (for Flutter: `flutter run -d <udid>`). Clean the status bar: `xcrun simctl status_bar booted override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100`. Capture: `xcrun simctl io booted screenshot --type=png <file>`. For another language, relaunch with `xcrun simctl launch booted <bundle_id> -AppleLanguages "(ja)" -AppleLocale ja_JP`. For iPad, repeat on a 13" iPad simulator.
   - **Android emulator or device**: `adb devices`. Clean the status bar with demo mode: `adb shell settings put global sysui_demo_allowed 1`, then `adb shell am broadcast -a com.android.systemui.demo -e command enter`, `... -e command clock -e hhmm 0941`, `... -e command battery -e level 100 -e plugged false`, `... -e command notifications -e visible false`. Capture: `adb exec-out screencap -p > <file>`. Exit with `-e command exit`. Change the language with the app's own language setting, or in the device Settings.
   - You usually cannot tap through the app yourself (on Android `adb shell input tap x y` works if you know the coordinates). Ask the user to open each screen, then capture when they say it is ready.
   - Use realistic demo data: no real personal data, no lorem ipsum, no debug banners.
4. **Write the captions for every locale.** Translate the headlines naturally, keep product names, keep each one short (Japanese and Korean fit fewer words per line; German and French run long, so re-check). Use the same register as the store text in that locale (`release/*/metadata/<locale>/`). Save them in `release/screenshots-src/captions.yml` (`<locale>: { 01_home: "…" }`) so a later run can reuse them.
5. **Compose** (captioned style, and Android raw captures above 2:1). Write one HTML template in `release/screenshots-src/frame.html` that takes the caption, the raw image path, the colors and the size from the query string, with:
   - `html, body { margin: 0; width: <W>px; height: <H>px; overflow: hidden; }` and an opaque background (color or gradient), never transparent;
   - the headline at the top, about 7% of the height for the font size, bold, centered, with a font stack that covers every language (`-apple-system, "SF Pro Display", "Hiragino Sans", "Apple SD Gothic Neo", "Noto Sans CJK JP", "Noto Sans", sans-serif`);
   - the raw screen below, scaled to fit, with rounded corners and a soft shadow.
   Render each image at the exact size with a headless browser, one of:
   - `npx -y playwright screenshot --viewport-size="1320, 2868" "file://<abs>/frame.html?…" <out.png>` (run `npx -y playwright install chromium` once if needed);
   - `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1320,2868 --screenshot=<out.png> "file://<abs>/frame.html?…"`.
   Sizes to render: iOS 1320x2868 (and 2064x2752 for iPad), Android 1080x1920. Feature graphic: 1024x500 with the app name and one tagline, no screenshot of a device needed. Play icon: resize the app's 1024 px icon (`ios/**/AppIcon.appiconset/*1024*.png` or the Android adaptive icon source) with `sips -z 512 512 <src> --out icon.png`.
6. **Check every file.** `sips -g pixelWidth -g pixelHeight -g hasAlpha <file>` (macOS). The size must match exactly; never stretch an image to fix a wrong size, render it again. If `hasAlpha: yes` where alpha is not allowed, flatten it: `sips -s format jpeg -s formatOptions 95 a.png --out a.jpg`, then either keep the JPG or convert back with `sips -s format png a.jpg --out a.png`.
7. **Put the files in place.** Name them `01_<screen>.png`, `02_…` so the order is right. Only write into locale folders that already exist. If a target folder already has images, show what is there and ask before replacing; when replacing, remove the old files the user agreed to drop (the stores would otherwise keep them, ordered by name).
8. **Verify.** Run `appship doctor --skip-artifacts` and fix every screenshot or image problem it reports (missing iPhone size, Play ratio or count, alpha channel, `_framed` files).
9. **Hand back to the user.** List the files per store and locale, and the source folder. Ask them to look at the images. Do not run `appship metadata`, `first-release` or `submit`. Tell them that `appship metadata` replaces **all** screenshots on App Store Connect for every locale it pushes, and that `appship metadata --no-screenshots` pushes text only.

## Store rules for the content

- Show the app in use. Not only a splash screen, logo or title art (App Store guideline 2.3.3).
- No other platform: no Android devices or "Google Play" in iOS images, no iPhones or "App Store" in Play images.
- No prices, "free", "sale", rankings, "#1", "best" or award claims unless the user can prove them, and no calls to action like "Download now" (Play metadata policy).
- No personal data of real people. Status bar at 9:41, full battery, no notifications.
- Text must be readable on a phone: large headline, at most two lines.
