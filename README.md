# appship-ai

**English** · [Tiếng Việt](docs/README.vi.md) · [Website](https://appship.ketchsoft.com)

Release **Android (Google Play)** and **iOS (App Store)** apps from a single config file, powered by [fastlane](https://fastlane.tools).

Each project only gets a `release/` folder with its config, store listing and questionnaire answers. All release logic lives in the tool, so updating appship updates every project that uses it.

```bash
appship init            # once per project
appship doctor          # check everything before releasing
appship first-release   # first time on the stores
appship upload --build  # build, then push to TestFlight / a Google Play track
appship submit          # iOS: send for App Review · Android: promote to production
```

> **Status: v0.1.0, early.** The code is covered by tests and dry-runs, but it has not yet been run against the live stores. Try `--dry-run` and read-only commands such as `appship status` first. See the [roadmap](docs/roadmap.md) (Vietnamese).

## Why

Shipping a mobile app means more than uploading a binary. There is the store listing, the screenshots, the age rating, privacy labels, export compliance, reviewer contacts, tracks and staged rollouts, across two consoles that each change often. fastlane can already do most of this, but every project ends up with its own copy-pasted Fastfile.

appship wraps fastlane in a small CLI:

- **One config per project** (`release/release.yml`). There is no Fastfile to maintain in your app repo.
- **Store questionnaires answered once** (`release/questionnaire.yml`). appship fills in whatever the store APIs allow. For the rest, it writes a `CHECKLIST.md` with your answers ready to copy into the console.
- **`appship doctor`** catches problems before the stores do: character limits, placeholder text, image sizes, missing or malformed keys, and keys accidentally committed to git.
- **Keys are handled safely.** You can use a named profile in `~/.appship`, files in a gitignored `release/keys/`, or environment variables for CI.
- **Works with any stack.** appship runs your build command and picks up the `.ipa` / `.aab`. Flutter, React Native, Cocos Creator and native projects are detected automatically.

## What is automated

| | iOS | Android |
|---|---|---|
| Create the app | `first-release --create-app` (needs an Apple ID login) | Manual: Google Play has no API. You get a checklist |
| Upload a build | TestFlight | internal / alpha / beta / production, staged rollout |
| Listing text and screenshots | push / pull | push / pull |
| Store questionnaires | Age rating, export compliance, content rights, review contact, App Privacy | Checklist pre-filled with your answers (content rating, data safety, target audience, ads, app access) |
| Submit | App Review | Promote a track to production |
| Status | Live / in review / pending / editable, latest TestFlight build | Version codes per track |

## Requirements

- macOS for iOS builds and uploads. Android-only use also works on Linux.
- Node.js 22+
- fastlane: `brew install fastlane`
- An Apple Developer Program account and/or a Google Play Console account

## Install

```bash
npm i -g appship-ai          # installs the `appship` command (alias: `appship-ai`)
npx appship-ai --help        # or run without installing

# from source
git clone https://github.com/ketchstudio/appship-ai.git
cd appship-ai && npm install && npm link
```

## Quick start

```bash
# 1. Store keys, once per developer account
#    App Store Connect API key (.p8) and/or a Google Play service account JSON
appship credentials add my-company

# 2. Set up a project
cd ~/Projects/my-app
appship init                 # detects framework, bundle id and package name

# 3. Fill in release/questionnaire.yml and release/*/metadata, add screenshots
#    (for an app that is already live: appship metadata pull)
appship doctor               # repeat until there are no errors

# 4. First release
appship first-release --create-app
#    then follow release/CHECKLIST.md for the steps the stores keep manual

# 5. Every release after that
appship upload --build
appship submit
appship status
```

Every command that writes to a store asks for confirmation. Pass `--yes` in CI, and use `--dry-run` to see exactly what would be sent.

## Project layout

```
my-app/
└── release/
    ├── release.yml            # ids, artifacts, build commands, tracks, credentials
    ├── questionnaire.yml      # answers to store questions
    ├── CHECKLIST.md           # generated: manual console steps with your answers
    ├── ios/metadata/<locale>/*.txt
    ├── ios/screenshots/<locale>/*.png
    ├── android/metadata/<locale>/{*.txt, images/}
    ├── keys/                  # gitignored; only if you don't use a profile
    └── .appship/              # gitignored; scratch files for fastlane runs
```

## Release notes in several languages

Both stores accept per-language release notes. Each locale is a folder:

- **iOS** ("What's New", max 4000 characters): `release/ios/metadata/<locale>/release_notes.txt`, e.g. `en-US`, `vi`, `ja`, `zh-Hans`. Missing locales are created on App Store Connect automatically. Leave it empty for the very first version, which Apple does not accept notes for.
- **Android** (max 500 characters): `release/android/metadata/<locale>/changelogs/default.txt`. The language must be enabled in Play Console first.

`appship init` also installs a Claude Code skill, `release-notes`, into `.claude/skills/`. Ask Claude to "write the release notes": it reads `git log` since the last tag, writes the primary-locale text, translates it into every locale folder, fits the store limits, and runs `appship doctor`. It only edits the files above; you review them and push. Release notes stay plain files, so you can always edit them by hand.

Declare the languages per platform in `release.yml` (optional; without it every folder is used):

```yaml
ios:
  locales: [en-US, vi, ja]
android:
  locales: [en-US, vi, ja-JP]
```

`appship doctor` then errors on a listed locale that has no folder, warns about a folder that is not listed, and rejects invalid App Store locale names before fastlane does. iOS and Android locale codes differ (`zh-Hans` vs `zh-CN`), so name the folders per platform. `appship doctor` checks length and warns when some locales have release notes and others don't. The full list of valid iOS locales is in [docs/configuration.md](docs/configuration.md) (Vietnamese).

### Suggested languages

To expand beyond the primary language, `appship init --locales preset` (or `--locales es,ja`) creates folders for Spanish (Spain and Latin America), Brazilian Portuguese, German, French, Japanese and Korean, and writes `locales` for each platform with that store's own codes:

| Language | iOS folder | Android folder |
|---|---|---|
| Spanish, Spain / Latin America | `es-ES` / `es-MX` | `es-ES` / `es-419` |
| Portuguese, Brazil | `pt-BR` | `pt-BR` |
| German | `de-DE` | `de-DE` |
| French | `fr-FR` | `fr-FR` |
| Japanese | `ja` | `ja-JP` |
| Korean | `ko` | `ko-KR` |

The new folders hold `TODO` placeholders that `appship doctor` fails on until you translate them. `doctor` also warns about an Android folder that is not a Google Play language code (for example `ja` instead of `ja-JP`) and suggests the right one. The `release-notes` skill knows each language's conventions (formal or informal address, regional variants, Japanese punctuation, French spacing). Details are in [docs/configuration.md](docs/configuration.md) (Vietnamese).

## Credentials

For each value, the first source found wins:

1. **Environment variables** (CI): `APPSHIP_ASC_KEY_ID`, `APPSHIP_ASC_ISSUER_ID`, `APPSHIP_ASC_KEY` (the `.p8` contents, plain or base64), `APPSHIP_PLAY_JSON`, …
2. **`release/release.yml`**: paths to files in the gitignored `release/keys/`.
3. **A profile**: `appship credentials add <name>` copies the keys to `~/.appship/credentials/<name>/` with mode 600. Projects then only reference `credentials.profile: <name>`.

A ready-to-use GitHub Actions workflow is in [`examples/github-actions.yml`](examples/github-actions.yml).

## iOS signing when you are not the account owner

Team API keys need an Account Holder or Admin, and so does creating certificates and profiles. If the owner gave you files instead, appship can work from them (it still doesn't build or sign for you; it audits the files, installs them and hands the signing setup to your build command):

```yaml
ios:
  build_command: 'flutter build ipa --release --export-options-plist="$APPSHIP_EXPORT_OPTIONS"'
  signing:
    style: manual
    certificate: release/keys/AppleDistribution.p12           # Apple Distribution certificate + private key
    profiles: [release/keys/AppStore.mobileprovision]         # App Store profile, one per bundle id
```

```bash
APPSHIP_P12_PASSWORD=... appship signing import   # install profiles, import the .p12
appship doctor                                    # profile type/expiry/team/bundle id, keychain, the built .ipa
```

- No team API key? Create an **individual** key (no Issuer ID, leave `issuer_id` empty). Not verified against a real account yet.
- No API key at all? Sign and build the same way, then upload the `.ipa` with Transporter or Xcode.
- All five cases, CI usage and what `doctor` checks: [docs/signing.md](docs/signing.md) (Vietnamese).

## Commands

| Command | What it does |
|---|---|
| `init` | Create `release/` with config, questionnaire and metadata templates, and update `.gitignore` |
| `doctor` | Check tools, config, credentials, git safety, artifacts, listing and questionnaire |
| `credentials add/list/remove` | Manage credential profiles |
| `signing import` / `signing export-options` | iOS: install the profiles and certificate you were given; write `ExportOptions.plist` for your build command |
| `build` | Run the configured build commands |
| `upload` | `.ipa` to TestFlight, `.aab` to a Play track (`--track`, `--rollout 20%`) |
| `metadata [push\|pull]` | Sync listing text and screenshots |
| `submit` | iOS App Review / Android promote to production |
| `promote` | Move an Android release between tracks or raise its rollout |
| `status` | Review state and versions on both stores |
| `first-release` | Create the iOS app, push the listing and App Privacy, write the checklist |
| `checklist` | Regenerate `release/CHECKLIST.md` |

Run `appship <command> --help` for all options.

## Documentation

The detailed guides are currently in Vietnamese:

- [Getting started](docs/getting-started.md)
- [Getting store keys](docs/credentials.md)
- [iOS signing when you are not the owner](docs/signing.md)
- [Configuration reference](docs/configuration.md)
- [Questionnaire reference](docs/questionnaire.md)
- [Commands](docs/commands.md)
- [CI](docs/ci.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Design decisions](docs/design.md)
- [Roadmap](docs/roadmap.md)
- [Development](docs/development.md)

## Contributing

Issues and pull requests are welcome at [ketchstudio/appship-ai](https://github.com/ketchstudio/appship-ai/issues).

```bash
npm install
npm test
```

## License

[MIT](LICENSE) © Ketchsoft. appship is a product powered by Ketchsoft.
