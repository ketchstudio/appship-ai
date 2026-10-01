---
name: app-content
description: Fill in release/questionnaire.yml, the store declarations for an app released with appship. App Store side covers age rating, App Privacy, export compliance, content rights and App Review contact. Google Play "App content" side covers Data safety, content rating (IARC), target audience, ads, app access, privacy policy. Answers come from the project's code and dependencies, and the user is asked what code cannot show. Use when the user asks to fill, answer, review or update the store questionnaire, age rating, privacy nutrition label, Data safety form, content rating, App content or submission questions.
---

# Store declarations (App content) for appship

Every answer the stores ask before review lives in one file, `release/questionnaire.yml`. appship sends the iOS part through the API (`metadata`, `submit`, `first-release`) and turns the Android part into `release/CHECKLIST.md`, because Play Console has no API for it. Your job is to fill that file with answers that match what the app really does. Never upload or submit anything.

The user signs these declarations, not you. Wrong answers lead to rejection or removal, so show the evidence for each answer, and ask when the code does not settle it. Never guess personal data (names, phone numbers, emails, demo passwords): leave `TODO` and ask.

## Steps

1. **Read the current state.** `release/release.yml` (which of `ios:` / `android:` exist), `release/questionnaire.yml` (current answers and remaining `TODO`s; if it is missing, tell the user to run `appship init`), the privacy URL in `release/ios/metadata/<primary>/privacy_url.txt`, and `docs/questionnaire.md` in the appship package if you need the field reference (`$(npm root -g)/appship-ai/docs/questionnaire.md`).
2. **Collect evidence from the project.** Read, as present:
   - Dependencies: `pubspec.yaml` / `pubspec.lock`, `package.json`, `ios/Podfile.lock`, `Package.resolved`, `android/app/build.gradle(.kts)`, `android/gradle/libs.versions.toml`.
   - iOS: `Info.plist` usage descriptions (`NS*UsageDescription`), `NSUserTrackingUsageDescription`, `ITSAppUsesNonExemptEncryption`, entitlements (HealthKit, Sign in with Apple), `PrivacyInfo.xcprivacy`.
   - Android: `AndroidManifest.xml` permissions (`INTERNET`, location, camera, contacts, `com.google.android.gms.permission.AD_ID`), `uses-feature`.
   - Code: login and account screens, chat or comments, user uploads, WebViews that open arbitrary URLs, purchases, ads, analytics calls with a user id (`setUserId`), data sent to the app's own backend.
3. **Map evidence to answers** with the table below. Rules that apply to both stores:
   - Data that stays on the device is **not collected**. Collected means sent off the device (to you or to an SDK).
   - Data collected by third-party SDKs counts as the app's data.
   - Data tied to an account or user id is **linked to the user** (iOS `linked_to_user: true`).
   - Tracking (iOS `used_for_tracking`) means combining data with other companies' data for ads, or sharing it with a data broker. Ad SDKs that use the IDFA do this.
   - Play "shared" means sent to a third party. Service providers that process data on your behalf and analytics that stay in your account usually do not count; ad networks do.
4. **Ask the user what the code cannot show**, in one short list, for example:
   - App Review contact (first and last name, phone with country code, email) and, if login is required, a demo account that works on production.
   - Content themes, mostly for games: violence, horror, mature themes, simulated gambling, contests, alcohol or drugs, profanity, medical information, and how often they appear.
   - Target age groups on Play, whether the app is meant for children, the IARC contact email.
   - Whether data is shared or sold, whether users can request deletion, and how.
   - Uses of cryptography beyond HTTPS and the OS (own encryption, VPN, end-to-end messaging).
5. **Edit `release/questionnaire.yml` in place.** Keep the comments and key order of the file and change values only. Use the exact enum values below; validation rejects anything else.
6. **Make the two stores agree.** The same app must not answer differently on each store:
   - Ads: `ios.age_rating.advertising` = `android.contains_ads`.
   - Chat or user content: `ios.age_rating.messagingAndChat` / `userGeneratedContent` = `android.content_rating.user_interaction`.
   - Real-money gambling: `ios.age_rating.gambling` = `android.content_rating.gambling`.
   - Purchases: `PURCHASE_HISTORY` on iOS ⇔ `content_rating.digital_purchases` and "Purchase history" on Play.
   - Every iOS `privacy.data` entry has a matching Play `data_safety.data` entry, and `collects_data` is the same on both.
   - Login required: `ios.review_information.demo_user` ⇔ `android.app_access.restricted: true` with instructions.
   - `android.privacy_policy_url` = the iOS `privacy_url.txt`.
7. **Verify.** Run `appship doctor --skip-artifacts --skip-screenshots` and fix every questionnaire error. Then `appship checklist` to regenerate `release/CHECKLIST.md`.
8. **Hand back to the user.** Show a table: question, answer, evidence (file and line, or "your answer"). List what is still `TODO` or needs their judgement. Mention related gaps you saw (no `PrivacyInfo.xcprivacy` while using required-reason APIs; account creation without in-app account deletion, which both stores require). Do not run `appship metadata`, `first-release`, `submit` or `promote`.

## Evidence → answers

| Evidence | iOS `privacy.data` (category: purposes) | Play `data_safety.data` type | Other answers |
|---|---|---|---|
| Firebase Analytics, Amplitude, Mixpanel, other analytics | `PRODUCT_INTERACTION`, often `DEVICE_ID`, `COARSE_LOCATION` from IP: `ANALYTICS` | App interactions, Device or other IDs, Approximate location: Analytics | |
| Crashlytics, Sentry, Bugsnag | `CRASH_DATA`, `PERFORMANCE_DATA`, `OTHER_DIAGNOSTIC_DATA`: `APP_FUNCTIONALITY` or `ANALYTICS` | Crash logs, Diagnostics | |
| AdMob, AppLovin, Unity Ads, ironSource, Meta Audience Network | `DEVICE_ID`, `ADVERTISING_DATA`, `PRODUCT_INTERACTION`, `COARSE_LOCATION`: `THIRD_PARTY_ADVERTISING`; `used_for_tracking: true` when the IDFA is used (ATT prompt present) | Device or other IDs, App interactions, Approximate location: Advertising or marketing; shared: true | `ios.age_rating.advertising: true`, `android.contains_ads: true` |
| Login (Firebase Auth, Sign in with Apple/Google, own backend) | `EMAIL_ADDRESS`, `NAME`, `USER_ID`: `APP_FUNCTIONALITY`, linked | Email address, Name, User IDs: Account management | Demo account, `app_access.restricted: true` |
| In-app purchases, subscriptions (StoreKit, Play Billing, RevenueCat) | `PURCHASE_HISTORY`: `APP_FUNCTIONALITY` | Purchase history | `content_rating.digital_purchases: true` |
| Location permission and the location is sent off device | `PRECISE_LOCATION` or `COARSE_LOCATION` | Precise / Approximate location | `content_rating.shares_location` only if other users can see it |
| Photos, camera, microphone and the media is uploaded | `PHOTOS_OR_VIDEOS`, `AUDIO` | Photos, Videos, Voice or sound recordings | |
| Contacts uploaded | `CONTACTS` | Contacts | |
| Chat, comments, posts, profiles visible to others | `EMAILS_OR_TEXT_MESSAGES` or `OTHER_USER_CONTENT` | Other in-app messages, Other user-generated content | `messagingAndChat`, `userGeneratedContent`, `content_rating.user_interaction: true` |
| HealthKit, Health Connect, fitness tracking | `HEALTH`, `FITNESS` | Health info, Fitness info | `healthOrWellnessTopics: true`, `android.health_app: true` |
| WebView or in-app browser to any URL | | | `unrestrictedWebAccess: true` |
| Only HTTPS / OS crypto | | | `uses_non_exempt_encryption: false` |
| Own crypto (CryptoSwift, libsodium, pointycastle for user data), VPN | | | Ask; `true` may need export documents |
| Shows or streams content the developer does not own | | | `content_rights.uses_third_party_content: true` |

When none of these apply and the app sends nothing off the device, set `collects_data: false` on both stores and keep `data: []`.

## Valid values

**iOS `age_rating`** (App Store Connect API names). Levels for `alcoholTobaccoOrDrugUseOrReferences`, `contests`, `gamblingSimulated`, `gunsOrOtherWeapons`, `horrorOrFearThemes`, `matureOrSuggestiveThemes`, `medicalOrTreatmentInformation`, `profanityOrCrudeHumor`, `sexualContentGraphicAndNudity`, `sexualContentOrNudity`, `violenceCartoonOrFantasy`, `violenceRealistic`, `violenceRealisticProlongedGraphicOrSadistic`: `NONE`, `INFREQUENT_OR_MILD`, `FREQUENT_OR_INTENSE`. True/false: `advertising`, `ageAssurance`, `gambling` (real money), `healthOrWellnessTopics`, `lootBox`, `messagingAndChat`, `parentalControls`, `unrestrictedWebAccess`, `userGeneratedContent`. Optional `kidsAgeBand` (Kids category only): `FIVE_AND_UNDER`, `SIX_TO_EIGHT`, `NINE_TO_ELEVEN`.

**iOS `privacy.data[].category`** (`Spaceship::ConnectAPI::AppDataUsageCategory`, fastlane 2.232.2): `NAME`, `EMAIL_ADDRESS`, `PHONE_NUMBER`, `PHYSICAL_ADDRESS`, `OTHER_CONTACT_INFO`, `HEALTH`, `FITNESS`, `PAYMENT_INFORMATION`, `CREDIT_AND_FRAUD`, `OTHER_FINANCIAL_INFO`, `PRECISE_LOCATION`, `COARSE_LOCATION`, `SENSITIVE_INFO`, `CONTACTS`, `EMAILS_OR_TEXT_MESSAGES`, `PHOTOS_OR_VIDEOS`, `AUDIO`, `GAMEPLAY_CONTENT`, `CUSTOMER_SUPPORT`, `OTHER_USER_CONTENT`, `BROWSING_HISTORY`, `SEARCH_HISTORY`, `USER_ID`, `DEVICE_ID`, `PURCHASE_HISTORY`, `PRODUCT_INTERACTION`, `ADVERTISING_DATA`, `OTHER_USAGE_DATA`, `CRASH_DATA`, `PERFORMANCE_DATA`, `OTHER_DIAGNOSTIC_DATA`, `OTHER_DATA`.

**iOS `purposes`**: `APP_FUNCTIONALITY`, `ANALYTICS`, `PRODUCT_PERSONALIZATION`, `DEVELOPERS_ADVERTISING`, `THIRD_PARTY_ADVERTISING`, `OTHER_PURPOSES`.

**Play `data_safety.data[].type`** (labels as in Play Console; appship copies them into the checklist): Approximate location, Precise location, Name, Email address, User IDs, Address, Phone number, Race and ethnicity, Political or religious beliefs, Sexual orientation, Other info, User payment info, Purchase history, Credit score, Other financial info, Health info, Fitness info, Emails, SMS or MMS, Other in-app messages, Photos, Videos, Voice or sound recordings, Music files, Other audio files, Files and docs, Calendar events, Contacts, App interactions, In-app search history, Installed apps, Other user-generated content, Other actions, Web browsing history, Crash logs, Diagnostics, Other app performance data, Device or other IDs.

**Play `purposes`**: App functionality, Analytics, Developer communications, Advertising or marketing, Fraud prevention, security, and compliance, Personalization, Account management.

**Play other fields**: `target_audience.age_groups` any of `"5 and under"`, `"6-8"`, `"9-12"`, `"13-15"`, `"16-17"`, `"18+"` (any group under 13 puts the app under the Families policy, which limits ads and SDKs; say so). `content_rating.category`: `"Game"`, `"Social, communication or dating"`, `"All other app types"`. `financial_features`: `none` or a short description.
