---
name: release-notes
description: Write multilingual release notes ("What's New") for an app released with appship. Use when the user asks to generate, draft, update or translate release notes / changelog / "what's new" for the App Store or Google Play.
---

# Release notes for appship

appship keeps release notes in plain files. Your job is to fill those files. Never upload anything.

| Store | File (one per locale folder) | Max characters |
|---|---|---|
| App Store | `release/ios/metadata/<locale>/release_notes.txt` | 4000 |
| Google Play | `release/android/metadata/<locale>/changelogs/default.txt` | 500 |

## Steps

1. **Find the locales.** Read `release/release.yml` (`app.primary_locale`, which of `ios:` / `android:` exist, and `ios.locales` / `android.locales` if declared; those lists are the languages to cover). List the locale folders under `release/ios/metadata/` and `release/android/metadata/`. Ignore `review_information` and `trade_representative_contact_information`. Only write to locales that already have a folder; if a declared locale has no folder, report it instead of creating it. If the user wants a new language, tell them the folder must exist first (iOS also needs `name.txt`, `description.txt`, `keywords.txt`, `support_url.txt`, `privacy_url.txt`); do not invent store listing text for them. A folder whose listing files still contain `TODO` is not ready to ship: write nothing there, and report it.
2. **Collect what changed.**
   - `git describe --tags --abbrev=0` gives the last release tag. Then `git log <tag>..HEAD --no-merges --pretty=format:%s`.
   - No tags: ask the user for the range or a short description of the changes.
   - Also read `CHANGELOG.md` if the project has one, and anything the user tells you.
3. **Write for end users, in the primary locale first.**
   - Short bullets ("- Faster quiz loading"), most important first.
   - Skip internal changes: refactors, CI, dependency bumps, tests, commit hashes, ticket ids.
   - No marketing claims that the changes do not support. If nothing user-visible changed, write a plain line such as "Bug fixes and performance improvements."
4. **Translate to every other locale folder.** Translate naturally, not word for word. Keep the same bullets. Keep product names untranslated. Follow the language guide below for register, regional variant and script.
5. **Respect the limits.** Count characters (code points), not bytes and not words. A kanji, a hangul syllable and a Latin letter each count as 1. Play's limit is 500, so the Android text is usually a shorter version of the iOS one. Shorten it instead of cutting mid-sentence. German and French run longer than English, Japanese and Korean shorter in characters, so re-check each file rather than assuming the English length carries over.
6. **First version of an app:** Apple rejects release notes on version 1.0. If this is the first release (no earlier store version, or the user says so), leave every iOS `release_notes.txt` empty. Android still gets a changelog.
7. **Do not overwrite silently.** If a target file already has text, show the old and new text and ask before replacing. Write with a trailing newline. Touch no other files.
8. **Verify.** Run `appship doctor --skip-artifacts` and fix any release-notes problem it reports (length, locales that are empty while others are filled, invalid locale folder names).
9. **Hand back to the user.** List each file you wrote with its text. Tell them to review it. Do not run `appship metadata`, `submit`, `upload` or `promote`; the user does that after reading the notes.

## Locale codes

iOS and Android use different codes. Never copy a folder name from one platform to the other.

- iOS (valid folder names): `ar-SA ca cs da de-DE el en-AU en-CA en-GB en-US es-ES es-MX fi fr-CA fr-FR he hi hr hu id it ja ko ms nl-NL no pl pt-BR pt-PT ro ru sk sv th tr uk vi zh-Hans zh-Hant`.
- Android: `en-US`, `vi`, `ja-JP`, `ko-KR`, `zh-CN`, `zh-TW`, … Use the folder names already present.

Suggested languages for a first expansion (`init --locales` creates these folders):

| Language | iOS folder | Android folder |
|---|---|---|
| Spanish, Spain | `es-ES` | `es-ES` |
| Spanish, Latin America | `es-MX` | `es-419` |
| Portuguese, Brazil | `pt-BR` | `pt-BR` |
| German | `de-DE` | `de-DE` |
| French | `fr-FR` | `fr-FR` |
| Japanese | `ja` | `ja-JP` |
| Korean | `ko` | `ko-KR` |

## Language guide

Match the tone of the primary-locale text the app already uses. If the register (formal or informal) is not obvious from existing store text, ask the user once instead of guessing, then keep it the same in every file.

- **Spanish.** `es-ES` is Spain (`vosotros` is fine, "ordenador", "móvil"). `es-MX` and `es-419` are Latin America: use `ustedes`, "computadora", "celular", and avoid Spain-only slang. Do not copy one variant into the other folder without adapting it. Consumer apps usually address the user as `tú`.
- **Portuguese (`pt-BR`).** Brazilian Portuguese only: "você", "celular", "tela", "baixar". Never European forms ("telemóvel", "ecrã").
- **German.** Choose `du` (consumer apps, games) or `Sie` (finance, business, health) and stay consistent. Compound nouns are long; shorten sentences rather than the meaning.
- **French.** `vous` unless the brand voice is clearly casual. Put a narrow no-break space (U+202F) or no-break space (U+00A0) before `?`, `!`, `:` and `;`.
- **Japanese.** Polite form (`です`/`ます`). No spaces between words. Use full-width punctuation (`。`, `、`, `！`, `？`) and `・` for list separators inside a line. Keep product and brand names in their original script. Do not stack exclamation marks.
- **Korean.** Polite form (`해요체`, or `합니다체` for formal apps). Words are separated by spaces. Use ASCII digits and keep product names in Latin script.
- **Bullets.** Keep the `- ` bullet marker in every language so the notes look the same across stores.
- **Keywords (`keywords.txt`) are not release notes.** Do not edit them here.
