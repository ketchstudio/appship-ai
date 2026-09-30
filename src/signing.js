import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { AppshipError, log } from './log.js';

export const SIGNING_STYLES = ['automatic', 'manual'];
// "app-store" is the pre-Xcode-15.3 name of "app-store-connect"; both upload to App Store Connect.
export const EXPORT_METHODS = ['app-store-connect', 'app-store'];
const SIGNING_KEYS = ['style', 'method', 'certificate', 'profiles'];
const EXPIRY_WARN_DAYS = 30;

/** ios.signing with defaults applied, or null when the project does not declare it. */
export function signingConfig(config) {
  const raw = config.ios?.signing;
  if (raw === undefined || raw === null) return null;
  return { style: 'automatic', method: 'app-store-connect', ...raw };
}

export function validateSigning(config, errors) {
  const raw = config.ios.signing;
  if (raw === undefined || raw === null) return;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push('ios.signing must be a mapping (style, method, certificate, profiles)');
    return;
  }
  for (const key of Object.keys(raw).filter((k) => !SIGNING_KEYS.includes(k))) {
    errors.push(`ios.signing.${key} is not a known option (use ${SIGNING_KEYS.join(', ')})`);
  }
  const s = signingConfig(config);
  if (!SIGNING_STYLES.includes(s.style)) errors.push(`ios.signing.style must be one of ${SIGNING_STYLES.join(', ')} (got "${s.style}")`);
  if (!EXPORT_METHODS.includes(s.method)) errors.push(`ios.signing.method must be one of ${EXPORT_METHODS.join(', ')} (got "${s.method}")`);
  if (s.certificate !== undefined && (typeof s.certificate !== 'string' || !s.certificate)) errors.push('ios.signing.certificate must be a path to a .p12 file');
  if (s.profiles !== undefined && (!Array.isArray(s.profiles) || s.profiles.some((p) => typeof p !== 'string' || !p))) {
    errors.push('ios.signing.profiles must be a list of .mobileprovision paths');
  }
  if (s.style === 'manual' && !(Array.isArray(s.profiles) && s.profiles.length)) {
    errors.push('ios.signing.profiles needs at least one .mobileprovision when style is manual');
  }
  if (s.style === 'automatic' && (s.certificate !== undefined || s.profiles !== undefined)) {
    errors.push('ios.signing.certificate and ios.signing.profiles are only used with style: manual');
  }
}

// ---------------------------------------------------------------------------------------------
// Property lists (only what provisioning profiles and ExportOptions need)
// ---------------------------------------------------------------------------------------------

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m]);

function tokenize(xml) {
  const tokens = [];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z]+)(?:\s[^>]*?)?\s*(\/?)>|([^<]+)/g;
  for (const m of xml.matchAll(re)) {
    if (m[2]) tokens.push({ kind: m[3] ? 'self' : m[1] ? 'close' : 'open', name: m[2] });
    else if (m[4] !== undefined && m[4].trim() !== '') tokens.push({ kind: 'text', value: decode(m[4]) });
  }
  return tokens;
}

/** Parse an XML property list into plain JS values (dict → object, array → array, date → Date, data → Buffer). */
export function parsePlist(xml) {
  const tokens = tokenize(xml);
  let i = tokens.findIndex((t) => t.kind === 'open' && t.name === 'plist') + 1;
  if (i === 0) throw new Error('not an XML property list');

  const expectClose = (name) => {
    if (tokens[i]?.kind !== 'close' || tokens[i].name !== name) throw new Error(`malformed plist near <${name}>`);
    i++;
  };
  const readText = (name) => {
    let text = '';
    if (tokens[i]?.kind === 'text') text = tokens[i++].value;
    expectClose(name);
    return text;
  };

  function value() {
    const t = tokens[i++];
    if (!t) throw new Error('unexpected end of plist');
    if (t.kind === 'self') {
      if (t.name === 'true') return true;
      if (t.name === 'false') return false;
      if (t.name === 'string') return '';
      if (t.name === 'dict') return {};
      if (t.name === 'array') return [];
      throw new Error(`unexpected <${t.name}/>`);
    }
    if (t.kind !== 'open') throw new Error('malformed plist');
    switch (t.name) {
      case 'dict': {
        const out = {};
        while (tokens[i]?.kind !== 'close') {
          if (tokens[i]?.kind !== 'open' || tokens[i].name !== 'key') throw new Error('malformed plist dict');
          i++;
          const key = readText('key');
          out[key] = value();
        }
        expectClose('dict');
        return out;
      }
      case 'array': {
        const out = [];
        while (tokens[i]?.kind !== 'close') out.push(value());
        expectClose('array');
        return out;
      }
      case 'string':
        return readText('string');
      case 'integer':
      case 'real':
        return Number(readText(t.name));
      case 'date':
        return new Date(readText('date'));
      case 'data':
        return Buffer.from(readText('data').replace(/\s+/g, ''), 'base64');
      default:
        throw new Error(`unsupported plist type <${t.name}>`);
    }
  }
  return value();
}

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function plistNode(v, indent) {
  const pad = '  '.repeat(indent);
  if (typeof v === 'boolean') return `${pad}<${v}/>`;
  if (typeof v === 'number') return `${pad}<integer>${v}</integer>`;
  if (v instanceof Date) return `${pad}<date>${v.toISOString().replace(/\.\d+Z$/, 'Z')}</date>`;
  if (Buffer.isBuffer(v)) return `${pad}<data>${v.toString('base64')}</data>`;
  if (Array.isArray(v)) return v.length ? `${pad}<array>\n${v.map((x) => plistNode(x, indent + 1)).join('\n')}\n${pad}</array>` : `${pad}<array/>`;
  if (typeof v === 'object' && v !== null) {
    const entries = Object.entries(v);
    if (!entries.length) return `${pad}<dict/>`;
    const body = entries.map(([k, val]) => `${pad}  <key>${xmlEscape(k)}</key>\n${plistNode(val, indent + 1)}`).join('\n');
    return `${pad}<dict>\n${body}\n${pad}</dict>`;
  }
  return `${pad}<string>${xmlEscape(v)}</string>`;
}

export function buildPlist(obj) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${plistNode(obj, 0)}
</plist>
`;
}

// ---------------------------------------------------------------------------------------------
// Provisioning profiles
// ---------------------------------------------------------------------------------------------

/** A .mobileprovision is a signed (not encrypted) blob wrapping an XML plist, so the plist can be cut out as-is. */
export function extractProfilePlist(buf) {
  const text = buf.toString('latin1');
  const start = text.indexOf('<?xml');
  const end = text.indexOf('</plist>');
  if (start === -1 || end === -1) throw new Error('no embedded property list (is this a .mobileprovision?)');
  return Buffer.from(text.slice(start, end + '</plist>'.length), 'latin1').toString('utf8');
}

function certInfo(der) {
  try {
    const x = new X509Certificate(der);
    return {
      sha1: x.fingerprint.replaceAll(':', '').toUpperCase(),
      name: x.subject.match(/^CN=(.+)$/m)?.[1] ?? 'unknown certificate',
      validTo: new Date(x.validTo),
    };
  } catch {
    return null;
  }
}

export function parseProfile(buf) {
  const p = parsePlist(extractProfilePlist(buf));
  const ent = p.Entitlements ?? {};
  const teamId = p.TeamIdentifier?.[0] ?? ent['com.apple.developer.team-identifier'] ?? null;
  const appId = String(ent['application-identifier'] ?? '');
  const prefix = p.ApplicationIdentifierPrefix?.[0] ?? teamId;
  let type = 'app-store';
  if (p.ProvisionsAllDevices === true) type = 'enterprise';
  else if (Array.isArray(p.ProvisionedDevices)) type = ent['get-task-allow'] === true ? 'development' : 'ad-hoc';

  return {
    name: p.Name ?? '',
    uuid: p.UUID ?? '',
    teamId,
    bundlePattern: prefix && appId.startsWith(`${prefix}.`) ? appId.slice(prefix.length + 1) : appId,
    platforms: p.Platform ?? [],
    type,
    expires: p.ExpirationDate instanceof Date ? p.ExpirationDate : null,
    certs: (p.DeveloperCertificates ?? []).map(certInfo).filter(Boolean),
  };
}

export function readProfileFile(file) {
  if (!fs.existsSync(file)) throw new AppshipError(`Provisioning profile not found: ${file}`);
  try {
    return parseProfile(fs.readFileSync(file));
  } catch (err) {
    throw new AppshipError(`Cannot read ${file}: ${err.message}`);
  }
}

/** Read the profile Xcode embedded into a built .ipa, or null when there is none. */
export function readIpaProfile(ipa) {
  const res = spawnSync('unzip', ['-p', ipa, 'Payload/*.app/embedded.mobileprovision'], { maxBuffer: 16 * 1024 * 1024 });
  if (res.error || res.status !== 0 || !res.stdout?.length) return null;
  try {
    return parseProfile(res.stdout);
  } catch {
    return null;
  }
}

/** Does an App ID from a profile ("com.x.app", "com.x.*" or "*") cover this bundle identifier? */
export function bundleMatches(pattern, bundleId) {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return bundleId.startsWith(pattern.slice(0, -1));
  return pattern === bundleId;
}

const daysUntil = (date, now) => Math.floor((date - now) / 864e5);

/**
 * Problems that would make Apple or Xcode reject a build signed with this profile.
 * Issues use the same {level, msg, hint} shape as the metadata checks.
 */
export function auditProfile(profile, { label, teamId, now = new Date() } = {}) {
  const issues = [];
  const add = (level, msg, hint) => issues.push({ level, msg: `${label}: ${msg}`, hint });

  if (profile.platforms.length && !profile.platforms.includes('iOS')) {
    add('error', `profile is for ${profile.platforms.join(', ')}, not iOS`, 'Create an iOS App Store profile in the Developer Portal → Profiles.');
  }
  if (profile.type !== 'app-store') {
    add('error', `this is a ${profile.type} profile; App Store Connect only accepts builds signed with an "App Store" distribution profile`, 'Developer Portal → Profiles → + → Distribution → App Store Connect.');
  }
  if (profile.expires) {
    const days = daysUntil(profile.expires, now);
    if (days < 0) add('error', `profile "${profile.name}" expired on ${profile.expires.toISOString().slice(0, 10)}`, 'Ask the account owner to regenerate it (Developer Portal → Profiles → Edit → Save) and download it again.');
    else if (days < EXPIRY_WARN_DAYS) add('warn', `profile "${profile.name}" expires in ${days} day(s)`, 'Regenerate it before the next release.');
  }
  if (teamId && profile.teamId && profile.teamId !== teamId) {
    add('error', `profile belongs to team ${profile.teamId} but ios.team_id is ${teamId}`, 'Use the profile from the same developer team, or fix ios.team_id.');
  }
  if (profile.certs.length && profile.certs.every((c) => c.validTo < now)) {
    add('error', 'every certificate inside this profile has expired', 'The owner must create a new distribution certificate and regenerate the profile with it.');
  }
  return issues;
}

// ---------------------------------------------------------------------------------------------
// Keychain (macOS)
// ---------------------------------------------------------------------------------------------

/** Valid code-signing identities (certificate + private key) visible to `security`; null when it cannot be asked. */
export function codesignIdentities() {
  if (process.platform !== 'darwin') return null;
  const res = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
  if (res.status !== 0) return null;
  return [...res.stdout.matchAll(/^\s*\d+\)\s+([0-9A-F]{40})\s+"(.*)"/gm)].map((m) => ({ sha1: m[1], name: m[2] }));
}

export function installedCertFor(profile, identities) {
  return profile.certs.find((c) => identities?.some((i) => i.sha1 === c.sha1)) ?? null;
}

// ---------------------------------------------------------------------------------------------
// ExportOptions.plist and build environment
// ---------------------------------------------------------------------------------------------

export function loadDeclaredProfiles(project) {
  const s = signingConfig(project.config);
  if (!s || s.style !== 'manual') return [];
  return s.profiles.map((p) => ({ file: project.resolve(p), ...readProfileFile(project.resolve(p)) }));
}

export function exportOptions(config, profiles, identities = null) {
  const s = signingConfig(config);
  const options = { method: s.method, signingStyle: s.style, uploadSymbols: true };
  const teamId = config.ios.team_id ?? profiles[0]?.teamId;
  if (teamId) options.teamID = teamId;
  if (s.style === 'manual') {
    options.signingCertificate = profiles.map((p) => installedCertFor(p, identities)).find(Boolean)?.sha1 ?? 'Apple Distribution';
    options.provisioningProfiles = {};
    for (const p of profiles) {
      const key = p.bundlePattern.includes('*') ? config.ios.bundle_id : p.bundlePattern;
      if (bundleMatches(p.bundlePattern, key)) options.provisioningProfiles[key] = p.name;
    }
  }
  return options;
}

export function exportOptionsPath(project) {
  return path.join(project.workDir, 'ExportOptions.plist');
}

export function writeExportOptions(project) {
  const profiles = loadDeclaredProfiles(project);
  const file = exportOptionsPath(project);
  fs.mkdirSync(project.workDir, { recursive: true });
  fs.writeFileSync(file, buildPlist(exportOptions(project.config, profiles, codesignIdentities())));
  return file;
}

/** Extra environment for build_command so it can sign the way release.yml says. Empty when signing is not declared. */
export function buildEnv(project, platform) {
  if (platform !== 'ios' || !signingConfig(project.config)) return {};
  const profiles = loadDeclaredProfiles(project);
  const env = { APPSHIP_EXPORT_OPTIONS: writeExportOptions(project), APPSHIP_IOS_BUNDLE_ID: project.config.ios.bundle_id };
  const teamId = project.config.ios.team_id ?? profiles[0]?.teamId;
  if (teamId) env.APPSHIP_IOS_TEAM_ID = teamId;
  return env;
}

// ---------------------------------------------------------------------------------------------
// Import certificate + profiles (appship signing import)
// ---------------------------------------------------------------------------------------------

function xcodeMajor() {
  const res = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
  return res.status === 0 ? Number(res.stdout.match(/Xcode (\d+)/)?.[1]) || null : null;
}

/** Xcode 16 moved provisioning profiles; when the version is unknown, install to both places. */
export function profileInstallDirs(major = xcodeMajor()) {
  const home = os.homedir();
  const modern = path.join(home, 'Library', 'Developer', 'Xcode', 'UserData', 'Provisioning Profiles');
  const legacy = path.join(home, 'Library', 'MobileDevice', 'Provisioning Profiles');
  if (major === null) return [modern, legacy];
  return [major >= 16 ? modern : legacy];
}

function security(args, { secret, dryRun } = {}) {
  const shown = args.map((a) => (a === secret ? '***' : a)).join(' ');
  if (dryRun) return log.dim(`  [dry-run] security ${shown}`);
  const res = spawnSync('security', args, { encoding: 'utf8' });
  if (res.status !== 0) throw new AppshipError(`security ${args[0]} failed: ${(res.stderr || res.stdout).trim() || `exit ${res.status}`}`);
}

/**
 * Install the declared profiles for Xcode and the .p12 into a keychain. Idempotent: a certificate the
 * profile already trusts and that is in the keychain is not imported again.
 */
export function importSigning(project, { dryRun = false, keychain, p12Password, keychainPassword } = {}) {
  const s = signingConfig(project.config);
  if (!s || s.style !== 'manual') throw new AppshipError('Set ios.signing.style: manual (with certificate and profiles) in release.yml first.');
  const profiles = loadDeclaredProfiles(project);

  for (const dir of profileInstallDirs()) {
    if (!dryRun) fs.mkdirSync(dir, { recursive: true });
    for (const p of profiles) {
      const dest = path.join(dir, `${p.uuid}.mobileprovision`);
      if (dryRun) log.dim(`  [dry-run] copy ${path.relative(project.root, p.file)} → ${dest}`);
      else {
        fs.copyFileSync(p.file, dest);
        log.ok(`Profile "${p.name}" (${p.bundlePattern}) → ${dest}`);
      }
    }
  }

  if (!s.certificate) {
    log.hint('No ios.signing.certificate declared, so the distribution certificate must already be in your keychain.');
    return profiles;
  }
  const p12 = project.resolve(s.certificate);
  if (!fs.existsSync(p12)) throw new AppshipError(`Certificate not found: ${p12}`);

  if (installedCertFor(profiles[0], codesignIdentities()) && !dryRun) {
    log.ok('Distribution certificate is already in the keychain — not importing it again');
    return profiles;
  }

  const target = keychain ? path.resolve(keychain) : null;
  if (target) {
    if (keychainPassword === undefined) throw new AppshipError('Set APPSHIP_KEYCHAIN_PASSWORD (a new password for the keychain appship creates or unlocks).');
    if (!fs.existsSync(target)) {
      security(['create-keychain', '-p', keychainPassword, target], { secret: keychainPassword, dryRun });
      security(['set-keychain-settings', '-lut', '21600', target], { dryRun });
    }
    security(['unlock-keychain', '-p', keychainPassword, target], { secret: keychainPassword, dryRun });
    if (!dryRun) {
      const list = spawnSync('security', ['list-keychains', '-d', 'user'], { encoding: 'utf8' });
      const current = [...list.stdout.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      if (!current.some((c) => fs.realpathSync(c) === fs.realpathSync(target))) security(['list-keychains', '-d', 'user', '-s', target, ...current]);
    }
  }

  const importArgs = ['import', p12, '-P', p12Password ?? '', '-T', '/usr/bin/codesign', '-T', '/usr/bin/security'];
  if (target) importArgs.push('-k', target);
  security(importArgs, { secret: p12Password || undefined, dryRun });
  if (target) security(['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', keychainPassword, target], { secret: keychainPassword, dryRun });
  if (!dryRun) log.ok(`Certificate ${path.relative(project.root, p12)} imported${target ? ` into ${target}` : ' into the default keychain'}`);
  return profiles;
}
