import { TODO } from './metadata.js';

// App Store Connect ageRatingDeclarations attributes (see spaceship AgeRatingDeclaration).
export const IOS_AGE_RATING_LEVEL_KEYS = [
  'alcoholTobaccoOrDrugUseOrReferences',
  'contests',
  'gamblingSimulated',
  'gunsOrOtherWeapons',
  'horrorOrFearThemes',
  'matureOrSuggestiveThemes',
  'medicalOrTreatmentInformation',
  'profanityOrCrudeHumor',
  'sexualContentGraphicAndNudity',
  'sexualContentOrNudity',
  'violenceCartoonOrFantasy',
  'violenceRealistic',
  'violenceRealisticProlongedGraphicOrSadistic',
];
export const IOS_AGE_RATING_BOOLEAN_KEYS = [
  'advertising',
  'ageAssurance',
  'gambling',
  'healthOrWellnessTopics',
  'lootBox',
  'messagingAndChat',
  'parentalControls',
  'unrestrictedWebAccess',
  'userGeneratedContent',
];
const LEVELS = ['NONE', 'INFREQUENT', 'INFREQUENT_OR_MILD', 'FREQUENT', 'FREQUENT_OR_INTENSE'];
const PRIVACY_PURPOSES = [
  'THIRD_PARTY_ADVERTISING',
  'DEVELOPERS_ADVERTISING',
  'ANALYTICS',
  'PRODUCT_PERSONALIZATION',
  'APP_FUNCTIONALITY',
  'OTHER_PURPOSES',
];

/** Paths (dot notation) of every string value that still contains a TODO placeholder. */
export function findTodos(obj, prefix = '') {
  if (typeof obj === 'string') return obj.includes(TODO) ? [prefix] : [];
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).flatMap(([k, v]) => findTodos(v, prefix ? `${prefix}.${k}` : k));
}

export function validateIosQuestionnaire(q = {}) {
  const errors = findTodos(q, 'ios').map((p) => `${p} still contains ${TODO}`);
  const ios = q ?? {};
  if (typeof ios.export_compliance?.uses_non_exempt_encryption !== 'boolean') {
    errors.push('ios.export_compliance.uses_non_exempt_encryption must be true or false');
  }
  const rating = ios.age_rating ?? {};
  for (const key of IOS_AGE_RATING_LEVEL_KEYS) {
    if (!LEVELS.includes(rating[key])) errors.push(`ios.age_rating.${key} must be one of ${LEVELS.join(', ')}`);
  }
  for (const key of IOS_AGE_RATING_BOOLEAN_KEYS) {
    if (typeof rating[key] !== 'boolean') errors.push(`ios.age_rating.${key} must be true or false`);
  }
  const privacy = ios.privacy ?? {};
  if (typeof privacy.collects_data !== 'boolean') errors.push('ios.privacy.collects_data must be true or false');
  if (privacy.collects_data) {
    if (!privacy.data?.length) errors.push('ios.privacy.data must list collected data types when collects_data is true');
    for (const [i, item] of (privacy.data ?? []).entries()) {
      if (!item.category) errors.push(`ios.privacy.data[${i}].category is required`);
      const bad = (item.purposes ?? []).filter((p) => !PRIVACY_PURPOSES.includes(p));
      if (!item.purposes?.length) errors.push(`ios.privacy.data[${i}].purposes is required`);
      if (bad.length) errors.push(`ios.privacy.data[${i}].purposes has unknown values: ${bad.join(', ')}`);
    }
  }
  const review = ios.review_information ?? {};
  for (const key of ['first_name', 'last_name', 'phone_number', 'email_address']) {
    if (!review[key]) errors.push(`ios.review_information.${key} is required`);
  }
  return errors;
}

export function validateAndroidQuestionnaire(q = {}) {
  const errors = findTodos(q, 'android').map((p) => `${p} still contains ${TODO}`);
  if (typeof q?.contains_ads !== 'boolean') errors.push('android.contains_ads must be true or false');
  if (!q?.target_audience?.age_groups?.length) errors.push('android.target_audience.age_groups is required');
  if (typeof q?.data_safety?.collects_data !== 'boolean') errors.push('android.data_safety.collects_data must be true or false');
  return errors;
}

export function iosAgeRating(q) {
  const rating = q?.age_rating ?? {};
  const out = {};
  for (const key of [...IOS_AGE_RATING_LEVEL_KEYS, ...IOS_AGE_RATING_BOOLEAN_KEYS]) {
    if (rating[key] !== undefined) out[key] = rating[key];
  }
  if (rating.kidsAgeBand) out.kidsAgeBand = rating.kidsAgeBand;
  return out;
}

/** Convert questionnaire privacy answers into the JSON upload_app_privacy_details_to_app_store expects. */
export function iosPrivacyDetails(q) {
  const privacy = q?.privacy ?? {};
  if (!privacy.collects_data) return [{ data_protections: ['DATA_NOT_COLLECTED'] }];
  return privacy.data.map((item) => ({
    category: item.category,
    purposes: [...new Set(item.purposes)].sort(),
    data_protections: [
      item.linked_to_user ? 'DATA_LINKED_TO_YOU' : 'DATA_NOT_LINKED_TO_YOU',
      ...(item.used_for_tracking ? ['DATA_USED_TO_TRACK_YOU'] : []),
    ].sort(),
  }));
}

export function iosReviewInformation(q) {
  const r = q?.review_information ?? {};
  const out = {};
  for (const key of ['first_name', 'last_name', 'phone_number', 'email_address', 'demo_user', 'demo_password', 'notes']) {
    if (r[key] !== undefined && r[key] !== null && r[key] !== '') out[key] = String(r[key]);
  }
  return out;
}

export function iosSubmissionInformation(q) {
  const out = { export_compliance_uses_encryption: Boolean(q?.export_compliance?.uses_non_exempt_encryption) };
  if (typeof q?.content_rights?.uses_third_party_content === 'boolean') {
    out.content_rights_contains_third_party_content = q.content_rights.uses_third_party_content;
  }
  return out;
}

const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : '(not answered)');

/** Steps App Store Connect has no API for (or needs a human the first time). Markdown lines. */
export function iosManualChecklist(config, q = {}) {
  const lines = [
    `## iOS — ${config.app.name} (${config.ios.bundle_id})`,
    '',
    'Automated by appship: app record (with --create-app), metadata, screenshots, age rating, review information, export compliance, App Privacy (needs apple_id), build upload, submission.',
    '',
    'Do these once in App Store Connect → your app:',
    '',
    '- [ ] **Pricing and Availability**: choose price (Free or a tier) and countries.',
    '- [ ] **App Information → Content Rights**: ' +
      (typeof q.content_rights?.uses_third_party_content === 'boolean'
        ? `answer "${yesNo(q.content_rights.uses_third_party_content)}" (appship sends this on submit).`
        : 'declare whether the app uses third-party content.'),
    '- [ ] **App Privacy → Privacy Policy URL** is set (comes from privacy_url.txt).',
    '- [ ] **Agreements, Tax and Banking** are active (Business section) — required for paid apps and IAP.',
  ];
  if (!q.privacy?.collects_data) {
    lines.push('- [ ] **App Privacy**: if not uploaded by appship, answer "No, we do not collect data".');
  }
  if (q.review_information?.demo_user) {
    lines.push(`- [ ] Make sure the demo account \`${q.review_information.demo_user}\` works on the production backend.`);
  }
  lines.push('- [ ] First version: leave release_notes.txt empty (Apple does not accept "What\'s New" on version 1.0).');
  return lines;
}

/** Google Play Console questionnaires have no public API; print the answers to copy in. */
export function androidManualChecklist(config, q = {}) {
  const cr = q.content_rating ?? {};
  const ds = q.data_safety ?? {};
  const ta = q.target_audience ?? {};
  const access = q.app_access ?? {};
  const lines = [
    `## Android — ${config.app.name} (${config.android.package_name})`,
    '',
    'Google Play has no API for creating an app or for the "App content" questionnaires. Do these once in Play Console:',
    '',
    `- [ ] **Create app**: Play Console → Create app → name "${config.app.name}", default language ${config.app.primary_locale}, App/Game, Free/Paid, accept declarations.`,
    '- [ ] **Invite the service account**: Users and permissions → invite the client_email from your service account JSON → grant "Release" permissions for this app.',
    `- [ ] **Upload the first AAB manually** to the Internal testing track (the API cannot upload until a first bundle exists). After that, \`appship upload --android\` works.`,
    '- [ ] **Play App Signing**: accept Google-managed signing when uploading the first AAB; keep your upload keystore safe.',
    '',
    '### Policy → App content',
    '',
    `- [ ] **Privacy policy**: ${q.privacy_policy_url ?? '(set android.privacy_policy_url in questionnaire.yml)'}`,
    `- [ ] **App access**: ${access.restricted ? `All or some functionality is restricted → add instructions: ${access.instructions ?? ''}` : 'All functionality is available without special access'}`,
    `- [ ] **Ads**: Contains ads → ${yesNo(q.contains_ads)}`,
    `- [ ] **Content rating** (IARC questionnaire), category: ${cr.category ?? '(not answered)'}, email: ${cr.email ?? '(not answered)'}`,
    `  - Violence: ${yesNo(cr.violence)} · Sexuality: ${yesNo(cr.sexuality)} · Language: ${yesNo(cr.language)}`,
    `  - Controlled substances: ${yesNo(cr.controlled_substances)} · Crude humor: ${yesNo(cr.crude_humor)} · Gambling: ${yesNo(cr.gambling)}`,
    `  - Users can interact / share content: ${yesNo(cr.user_interaction)} · Shares location: ${yesNo(cr.shares_location)} · Digital purchases: ${yesNo(cr.digital_purchases)}`,
    `- [ ] **Target audience**: age groups ${ta.age_groups?.join(', ') ?? '(not answered)'}; may unintentionally appeal to children → ${yesNo(ta.appeals_to_children)}`,
    `- [ ] **Data safety**: collects data → ${yesNo(ds.collects_data)}; shares data → ${yesNo(ds.shares_data)}; encrypted in transit → ${yesNo(ds.encrypted_in_transit)}; users can request deletion → ${yesNo(ds.deletion_request)}`,
  ];
  for (const item of ds.data ?? []) {
    lines.push(`  - ${item.type}: collected=${yesNo(item.collected)}, shared=${yesNo(item.shared)}, optional=${yesNo(item.optional)}, purposes: ${(item.purposes ?? []).join(', ')}`);
  }
  lines.push(
    `- [ ] **News app**: ${yesNo(q.news_app)} · **Government app**: ${yesNo(q.government_app)} · **Health app**: ${yesNo(q.health_app)}`,
    `- [ ] **Financial features**: ${q.financial_features ?? 'none'}`,
    '',
    '### Before production',
    '',
    '- [ ] **Store settings**: app category, contact email, website.',
    '- [ ] **Countries/regions** for production.',
    '- [ ] **New personal developer accounts**: run a closed test (track "alpha") with at least 12 testers for 14 continuous days before you can apply for production access.',
  );
  return lines;
}
