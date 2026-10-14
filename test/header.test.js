import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, verify } from 'node:crypto';
import { appleToken, findHeaderTarget, uploadHeaderImage, validateHeaderImage } from '../src/apple-header.js';
import { appship, fakeFlutterProject, pngBuffer, tmpDir, FAKE_P8 } from './helpers.js';

test('header validates Apple sizes and rejects alpha', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'header.png');
  fs.writeFileSync(file, pngBuffer(3840, 1646));
  assert.equal(validateHeaderImage(file).width, 3840);
  fs.writeFileSync(file, pngBuffer(5244, 2950));
  assert.equal(validateHeaderImage(file).height, 2950);
  fs.writeFileSync(file, pngBuffer(3840, 1646, { alpha: true }));
  assert.throws(() => validateHeaderImage(file), /alpha/);
  fs.writeFileSync(file, pngBuffer(1000, 1000));
  assert.throws(() => validateHeaderImage(file), /3840×1646/);
});

test('header dry-run checks file and credentials without contacting Apple', () => {
  const { root, write } = fakeFlutterProject();
  const env = { APPSHIP_HOME: tmpDir(), APPSHIP_ASC_KEY_ID: 'ABC123', APPSHIP_ASC_ISSUER_ID: 'ISSUER', APPSHIP_ASC_KEY: FAKE_P8 };
  assert.equal(appship(['init', '--yes', '--platforms', 'ios'], { cwd: root, env }).code, 0);
  write('header.png', pngBuffer(3840, 1646));
  const result = appship(['header', '--file', 'header.png', '--app-version', '1.0', '--dry-run'], { cwd: root, env });
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Product Page Header placement/);
  assert.match(result.out, /3840×1646/);
});

test('Apple JWT uses ES256 with a raw signature', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const file = path.join(tmpDir(), 'key.p8');
  fs.writeFileSync(file, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  const token = appleToken({ key_id: 'KEY', issuer_id: 'ISSUER', key_path: file });
  const [header, payload, signature] = token.split('.');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'ES256');
  assert.equal(JSON.parse(Buffer.from(payload, 'base64url')).aud, 'appstoreconnect-v1');
  assert.ok(verify('SHA256', Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
  const individual = JSON.parse(Buffer.from(appleToken({ key_id: 'KEY', key_path: file }).split('.')[1], 'base64url'));
  assert.equal(individual.sub, 'user');
  assert.equal(individual.iss, undefined);
});

test('header API finds editable locale, uploads parts, and restores the old placement on failure', async () => {
  const file = path.join(tmpDir(), 'header.png');
  fs.writeFileSync(file, pngBuffer(3840, 1646));
  const calls = [];
  let restore = false;
  const api = async (method, endpoint, body) => {
    calls.push({ method, endpoint, body });
    if (endpoint.startsWith('/apps?')) return { data: [{ id: 'app1' }] };
    if (endpoint.includes('/appStoreVersions?')) return { data: [{ id: 'version1', attributes: { versionString: '1.0', appStoreState: 'PREPARE_FOR_SUBMISSION' } }] };
    if (endpoint.includes('/appStoreVersionLocalizations?')) return { data: [{ id: 'locale1', attributes: { locale: 'en-US' } }] };
    if (endpoint.endsWith('/assetLibrary')) return { data: { id: 'library1' } };
    if (endpoint.includes('/placements?')) return { data: [{ id: 'old', attributes: { placementGroup: 'DEFAULT_PROFILE' }, relationships: { image: { data: { id: 'old-image' } } } }] };
    if (method === 'POST' && endpoint === '/appAssetLibraryImages') return { data: { id: 'new-image', attributes: { uploadOperations: [{ offset: 0, length: 26, method: 'PUT', url: 'https://example.test/upload', requestHeaders: [] }] } } };
    if (method === 'GET' && endpoint === '/appAssetLibraryImages/new-image') return { data: { attributes: { state: 'PREPARE_FOR_SUBMISSION' } } };
    if (method === 'POST' && endpoint === '/appAssetLibraryPlacements' && !restore) { restore = true; throw new Error('placement failed'); }
    return { data: {} };
  };
  const target = await findHeaderTarget(api, { bundleId: 'com.example.app', version: '1.0', locale: 'en-US' });
  assert.equal(target.libraryId, 'library1');
  await assert.rejects(uploadHeaderImage(api, target, file, { fetchImpl: async (_url, options) => {
    assert.equal(options.body.length, 26);
    return { ok: true };
  }, sleep: async () => {} }), /placement failed/);
  const placements = calls.filter((call) => call.endpoint === '/appAssetLibraryPlacements');
  assert.equal(placements.length, 2);
  assert.equal(placements[0].body.data.relationships.image.data.id, 'new-image');
  assert.equal(placements[1].body.data.relationships.image.data.id, 'old-image');
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.body.data.attributes.uploaded === true));
});

test('header API places a new asset without deleting unrelated placements', async () => {
  const file = path.join(tmpDir(), 'header.png');
  fs.writeFileSync(file, pngBuffer(3840, 1646));
  const calls = [];
  const api = async (method, endpoint, body) => {
    calls.push({ method, endpoint, body });
    if (endpoint.includes('/placements?')) return { data: [{ id: 'screenshot', attributes: { placementGroup: 'IPHONE_PROFILE' } }] };
    if (method === 'POST' && endpoint === '/appAssetLibraryImages') return { data: { id: 'image1', attributes: { uploadOperations: [{ offset: 0, length: 26, method: 'PUT', url: 'https://example.test/upload', requestHeaders: [] }] } } };
    if (method === 'GET' && endpoint === '/appAssetLibraryImages/image1') return { data: { attributes: { state: 'PREPARE_FOR_SUBMISSION' } } };
    return { data: {} };
  };
  const id = await uploadHeaderImage(api, { libraryId: 'library1', localizationId: 'locale1' }, file, { fetchImpl: async () => ({ ok: true }) });
  assert.equal(id, 'image1');
  assert.equal(calls.filter((call) => call.method === 'DELETE').length, 0);
  assert.equal(calls.find((call) => call.endpoint === '/appAssetLibraryPlacements').body.data.attributes.placementType, 'PRODUCT_PAGE_HEADER_ASSET');
});
