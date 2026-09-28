import fs from 'node:fs';
import path from 'node:path';
import { AppshipError } from './log.js';
import { checkCredentialFiles, resolveCredentials } from './credentials.js';
import { iosAgeRating, iosPrivacyDetails, iosReviewInformation, iosSubmissionInformation } from './questionnaire.js';

function writeJson(project, name, data) {
  fs.mkdirSync(project.workDir, { recursive: true });
  const file = path.join(project.workDir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export function requireCredentials(project, platform) {
  const creds = resolveCredentials(project);
  const problems = checkCredentialFiles(creds, platform);
  if (problems.length) {
    throw new AppshipError(`${platform} credentials are incomplete:\n  - ${problems.join('\n  - ')}\nSee docs/credentials.md or run "appship doctor".`);
  }
  return creds;
}

/** Everything the iOS lanes need, as plain JSON (absolute paths, no YAML knowledge in Ruby). */
export function iosContext(project, extra = {}) {
  const { config, questionnaire } = project;
  const ios = config.ios;
  const creds = extra.skipApiKey ? resolveCredentials(project) : requireCredentials(project, 'ios');
  const q = questionnaire.ios ?? {};
  const ageRating = iosAgeRating(q);

  return {
    app: { name: config.app.name, primary_locale: config.app.primary_locale },
    ios: {
      bundle_id: ios.bundle_id,
      team_id: ios.team_id ?? null,
      itc_team_id: ios.itc_team_id ?? null,
      sku: ios.sku ?? ios.bundle_id,
      api_key: { key_id: creds.ios.key_id, issuer_id: creds.ios.issuer_id, key_filepath: creds.ios.key_path },
      apple_id: creds.ios.apple_id ?? null,
      version: extra.version ?? ios.version ?? null,
      build_number: extra.buildNumber ?? null,
      metadata_path: project.resolve(ios.metadata_path),
      screenshots_path: project.resolve(ios.screenshots_path),
      upload_screenshots: extra.screenshots ?? ios.upload_screenshots,
      skip_metadata: extra.skipMetadata ?? false,
      age_rating_path: Object.keys(ageRating).length ? writeJson(project, 'age_rating.json', ageRating) : null,
      privacy_path: q.privacy ? writeJson(project, 'app_privacy_details.json', iosPrivacyDetails(q)) : null,
      review_information: iosReviewInformation(q),
      submission_information: iosSubmissionInformation(q),
      automatic_release: ios.submit.automatic_release,
      phased_release: ios.submit.phased_release,
      reset_ratings: ios.submit.reset_ratings,
      ...extra.ios,
    },
  };
}

export function androidContext(project, extra = {}) {
  const { config } = project;
  const android = config.android;
  const creds = requireCredentials(project, 'android');
  const rollout = extra.rollout ?? android.rollout;
  // Google Play only accepts a partial rollout together with status "inProgress".
  const releaseStatus = rollout < 1 ? 'inProgress' : (extra.releaseStatus ?? android.release_status);

  return {
    app: { name: config.app.name, primary_locale: config.app.primary_locale },
    android: {
      package_name: android.package_name,
      json_key: creds.android.json_key_path,
      track: extra.track ?? android.track,
      release_status: releaseStatus,
      rollout: rollout < 1 ? rollout : null,
      metadata_path: project.resolve(android.metadata_path),
      upload_screenshots: extra.screenshots ?? android.upload_screenshots,
      ...extra.android,
    },
  };
}
