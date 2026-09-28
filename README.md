# appship-ai

**English** · [Tiếng Việt](docs/README.vi.md)

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
git clone https://github.com/ketchstudio/auto-app-store-upload-plugin.git
cd auto-app-store-upload-plugin && npm install && npm link
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

## Credentials

For each value, the first source found wins:

1. **Environment variables** (CI): `APPSHIP_ASC_KEY_ID`, `APPSHIP_ASC_ISSUER_ID`, `APPSHIP_ASC_KEY` (the `.p8` contents, plain or base64), `APPSHIP_PLAY_JSON`, …
2. **`release/release.yml`**: paths to files in the gitignored `release/keys/`.
3. **A profile**: `appship credentials add <name>` copies the keys to `~/.appship/credentials/<name>/` with mode 600. Projects then only reference `credentials.profile: <name>`.

A ready-to-use GitHub Actions workflow is in [`examples/github-actions.yml`](examples/github-actions.yml).

## Commands

| Command | What it does |
|---|---|
| `init` | Create `release/` with config, questionnaire and metadata templates, and update `.gitignore` |
| `doctor` | Check tools, config, credentials, git safety, artifacts, listing and questionnaire |
| `credentials add/list/remove` | Manage credential profiles |
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
- [Configuration reference](docs/configuration.md)
- [Questionnaire reference](docs/questionnaire.md)
- [Commands](docs/commands.md)
- [CI](docs/ci.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Design decisions](docs/design.md)
- [Roadmap](docs/roadmap.md)
- [Development](docs/development.md)

## Contributing

Issues and pull requests are welcome at [ketchstudio/auto-app-store-upload-plugin](https://github.com/ketchstudio/auto-app-store-upload-plugin/issues).

```bash
npm install
npm test
```

## License

[MIT](LICENSE) © Ketchsoft. appship is a product powered by Ketchsoft.
