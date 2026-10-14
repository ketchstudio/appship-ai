import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { AppshipError } from './log.js';
import { pngSize } from './metadata.js';

const BASE = 'https://api.appstoreconnect.apple.com/v1';
const HEADER_TYPE = 'PRODUCT_PAGE_HEADER_ASSET';
const HEADER_GROUP = 'DEFAULT_PROFILE';
const EDITABLE = new Set(['PREPARE_FOR_SUBMISSION', 'INVALID_BINARY', 'REJECTED', 'METADATA_REJECTED', 'DEVELOPER_REJECTED']);

function jpegSize(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7), alpha: false };
    }
    offset += 2 + length;
  }
  return null;
}

export function validateHeaderImage(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new AppshipError(`Header image not found: ${file}`);
  const ext = path.extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) throw new AppshipError('Header image must be PNG or JPEG. Video headers are not supported yet.');
  const size = ext === '.png' ? pngSize(file) : jpegSize(file);
  if (!size) throw new AppshipError(`Cannot read image dimensions: ${file}`);
  if (size.alpha) throw new AppshipError('Header image must not have an alpha channel. Flatten it before upload.');
  const universal = size.width === 5244 && size.height === 2950 && ext === '.png';
  const header = size.width === 3840 && size.height === 1646;
  if (!universal && !header) throw new AppshipError('Header image must be 3840×1646 PNG/JPEG or 5244×2950 PNG (universal).');
  return { ...size, bytes: fs.statSync(file).size };
}

export function appleToken({ key_id, issuer_id, key_path }, now = Date.now()) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'ES256', kid: key_id, typ: 'JWT' });
  const payload = encode({ ...(issuer_id ? { iss: issuer_id } : { sub: 'user' }), iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 1200, aud: 'appstoreconnect-v1' });
  const input = `${header}.${payload}`;
  const sign = createSign('SHA256');
  sign.update(input);
  sign.end();
  return `${input}.${sign.sign({ key: fs.readFileSync(key_path), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

export function appleClient(credentials, fetchImpl = fetch) {
  const token = appleToken(credentials);
  return async (method, endpoint, data) => {
    const response = await fetchImpl(`${BASE}${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.errors?.map((e) => e.detail || e.title || e.code).join('; ') || response.statusText;
      throw new AppshipError(`App Store Connect ${method} ${endpoint} failed (${response.status}): ${detail}`);
    }
    return body;
  };
}

const link = (type, id) => ({ data: { type, id } });

export async function findHeaderTarget(api, { bundleId, version, locale }) {
  const apps = await api('GET', `/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=2`);
  const app = apps.data?.[0];
  if (!app) throw new AppshipError(`App ${bundleId} not found in App Store Connect`);
  const versions = await api('GET', `/apps/${encodeURIComponent(app.id)}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${encodeURIComponent(version)}&limit=20`);
  const match = versions.data?.filter((item) => item.attributes?.versionString === version) ?? [];
  const editable = match.find((item) => EDITABLE.has(item.attributes?.appStoreState));
  if (!editable) throw new AppshipError(`iOS version ${version} is not editable. Create a new version in App Store Connect before adding a header.`);
  const localizations = await api('GET', `/appStoreVersions/${encodeURIComponent(editable.id)}/appStoreVersionLocalizations?limit=200`);
  const localization = localizations.data?.find((item) => item.attributes?.locale === locale);
  if (!localization) throw new AppshipError(`Locale ${locale} is not present on iOS version ${version}`);
  const library = await api('GET', `/apps/${encodeURIComponent(app.id)}/assetLibrary`);
  if (!library.data?.id) throw new AppshipError('App Asset Library not found for this app');
  return { appId: app.id, versionId: editable.id, localizationId: localization.id, libraryId: library.data.id };
}

async function existingHeader(api, localizationId) {
  const query = `filter[placementType]=${HEADER_TYPE}&limit=50&include=image`;
  const result = await api('GET', `/appStoreVersionLocalizations/${encodeURIComponent(localizationId)}/placements?${query}`);
  return result.data?.find((item) => item.attributes?.placementGroup === HEADER_GROUP) ?? null;
}

async function waitForImage(api, imageId, sleep) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = await api('GET', `/appAssetLibraryImages/${encodeURIComponent(imageId)}`);
    const state = result.data?.attributes?.state;
    if (state === 'PREPARE_FOR_SUBMISSION' || state === 'APPROVED') return;
    if (state === 'FAILED') throw new AppshipError(`Apple could not process the header: ${JSON.stringify(result.data?.attributes?.stateDetails ?? '')}`);
    await sleep(2000);
  }
  throw new AppshipError(`Header image ${imageId} is still processing. It is in Asset Library; retry placement after processing completes.`);
}

export async function uploadHeaderImage(api, target, file, { fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const { bytes } = validateHeaderImage(file);
  const previous = await existingHeader(api, target.localizationId);
  const reservation = await api('POST', '/appAssetLibraryImages', {
    data: {
      type: 'appAssetLibraryImages',
      attributes: { fileName: path.basename(file), fileSize: bytes, category: 'CREATIVE_ASSETS', referenceName: path.basename(file) },
      relationships: { assetLibrary: link('appAssetLibraries', target.libraryId) },
    },
  });
  const imageId = reservation.data?.id;
  const operations = reservation.data?.attributes?.uploadOperations;
  if (!imageId || !Array.isArray(operations) || !operations.length) throw new AppshipError('Apple did not return upload instructions for the header image');
  const image = fs.readFileSync(file);
  for (const operation of operations) {
    const { offset, length, method, url } = operation;
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || offset + length > image.length || !/^https:\/\//.test(url)) {
      throw new AppshipError('Apple returned invalid upload instructions');
    }
    const headers = Object.fromEntries((operation.requestHeaders ?? []).map(({ name, value }) => [name, value]));
    const response = await fetchImpl(url, { method, headers, body: image.subarray(offset, offset + length) });
    if (!response.ok) throw new AppshipError(`Header upload failed (${response.status}): ${response.statusText}`);
  }
  await api('PATCH', `/appAssetLibraryImages/${encodeURIComponent(imageId)}`, { data: { type: 'appAssetLibraryImages', id: imageId, attributes: { uploaded: true } } });
  await waitForImage(api, imageId, sleep);
  const placement = (assetId) => ({
    data: {
      type: 'appAssetLibraryPlacements',
      attributes: { placementType: HEADER_TYPE, placementGroup: HEADER_GROUP },
      relationships: { image: link('appAssetLibraryImages', assetId), appStoreVersionLocalization: link('appStoreVersionLocalizations', target.localizationId) },
    },
  });
  const previousImageId = previous?.relationships?.image?.data?.id;
  if (previous && !previousImageId) throw new AppshipError('Existing header placement has no image ID; no placement was changed');
  if (previous) await api('DELETE', `/appAssetLibraryPlacements/${encodeURIComponent(previous.id)}`);
  try {
    await api('POST', '/appAssetLibraryPlacements', placement(imageId));
  } catch (error) {
    if (previousImageId) {
      try { await api('POST', '/appAssetLibraryPlacements', placement(previousImageId)); }
      catch (restoreError) { throw new AppshipError(`${error.message}; restoring the old header also failed: ${restoreError.message}`); }
    }
    throw error;
  }
  return imageId;
}
