import fs from 'node:fs';
import path from 'node:path';

export const FRAMEWORKS = {
  flutter: {
    label: 'Flutter',
    ios: { artifact: 'build/ios/ipa/*.ipa', build_command: 'flutter build ipa --release' },
    android: { artifact: 'build/app/outputs/bundle/release/*.aab', build_command: 'flutter build appbundle --release' },
  },
  'react-native': {
    label: 'React Native',
    ios: { artifact: 'build/ios/*.ipa', build_command: 'fastlane gym --project_path ios --output_directory build/ios' },
    android: { artifact: 'android/app/build/outputs/bundle/release/*.aab', build_command: 'cd android && ./gradlew bundleRelease' },
  },
  cocos: {
    label: 'Cocos Creator',
    // Cocos output folders depend on the build task name; the glob covers the default layout.
    ios: { artifact: 'build/ios/**/*.ipa', build_command: '' },
    android: { artifact: 'build/android/**/outputs/bundle/release/*.aab', build_command: '' },
  },
  native: {
    label: 'Native (Xcode / Gradle)',
    ios: { artifact: 'build/ios/*.ipa', build_command: 'fastlane gym --output_directory build/ios' },
    android: { artifact: 'app/build/outputs/bundle/release/*.aab', build_command: './gradlew bundleRelease' },
  },
  none: {
    label: 'Other / I build myself',
    ios: { artifact: 'build/*.ipa', build_command: '' },
    android: { artifact: 'build/*.aab', build_command: '' },
  },
};

const exists = (root, ...p) => fs.existsSync(path.join(root, ...p));
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

export function detectFramework(root) {
  if (exists(root, 'pubspec.yaml')) return 'flutter';
  const pkg = read(path.join(root, 'package.json'));
  if (/"react-native"\s*:/.test(pkg)) return 'react-native';
  if (/"creator"\s*:/.test(pkg) || exists(root, 'settings', 'project.json') || exists(root, 'project.json')) {
    if (exists(root, 'assets')) return 'cocos';
  }
  if (exists(root, 'gradlew') || exists(root, 'settings.gradle') || exists(root, 'settings.gradle.kts')) return 'native';
  if (fs.existsSync(root) && fs.readdirSync(root).some((f) => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'))) return 'native';
  return 'none';
}

export function detectAndroidPackage(root) {
  const candidates = ['android/app/build.gradle', 'android/app/build.gradle.kts', 'app/build.gradle', 'app/build.gradle.kts'];
  for (const rel of candidates) {
    const m = read(path.join(root, rel)).match(/applicationId\s*=?\s*["']([\w.]+)["']/);
    if (m) return m[1];
  }
  return null;
}

export function detectIosBundleId(root) {
  const dirs = ['ios', '.'].map((d) => path.join(root, d)).filter((d) => fs.existsSync(d));
  for (const dir of dirs) {
    const projects = fs.readdirSync(dir).filter((f) => f.endsWith('.xcodeproj'));
    for (const proj of projects) {
      const ids = [...read(path.join(dir, proj, 'project.pbxproj')).matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([\w.\-]+)"?;/g)]
        .map((m) => m[1])
        .filter((id) => !/tests?$/i.test(id) && !id.includes('$'));
      if (ids.length) return ids[0];
    }
  }
  return null;
}

export function detectAppName(root) {
  const pubspec = read(path.join(root, 'pubspec.yaml')).match(/^name:\s*(\S+)/m);
  if (pubspec) return pubspec[1];
  try {
    const pkg = JSON.parse(read(path.join(root, 'package.json')) || '{}');
    if (pkg.name) return pkg.name;
  } catch {
    // ignore malformed package.json
  }
  return path.basename(root);
}
