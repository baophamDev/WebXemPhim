/**
 * Đóng gói app Android của BảoNhànCinema thành một file .apk cài được.
 *
 * Cách chạy: build-apk.cmd [tham số] — hoặc trực tiếp: node scripts/build-apk.mjs
 *
 * Bốn việc, theo thứ tự:
 *   1. build apps/web với VITE_API_URL đã chọn (mặc định là API production),
 *   2. chép apps/web/dist vào android/app/src/main/assets/web — bước này là thứ
 *      biến APK thành app local: giao diện nằm trong máy, không tải từ Vercel,
 *   3. gọi Gradle dựng APK (AGP + Android SDK, JDK 17 trong .tools/),
 *   4. chép APK ra android-out/ và cài lên thiết bị nếu được yêu cầu.
 *
 * Chỉ dành cho Windows: nó gọi cmd và dùng đường dẫn kiểu `D:\...`. Máy khác thì
 * chạy Gradle trong `android/` trực tiếp — xem docs/android.md.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_DIR = join(ROOT, 'android');
const ASSETS_WEB = join(ANDROID_DIR, 'app', 'src', 'main', 'assets', 'web');
const DIST_WEB = join(ROOT, 'apps', 'web', 'dist');
const OUT_DIR = join(ROOT, 'android-out');
const OUT_APK = join(OUT_DIR, 'BaoNhanCinema.apk');
/** API production. Chỉ dùng khi .env không có VITE_API_URL tuyệt đối. */
const FALLBACK_API = 'https://webxemphim-production-2d70.up.railway.app/api';
const WIN = process.platform === 'win32';

const log = (message) => console.log(message);
const step = (message) => console.log(`\n=== ${message} ===`);
function fail(message) {
  console.error(`\n*** ${message}`);
  process.exit(1);
}

/** Bọc nháy cho tham số có khoảng trắng — cmd.exe cần, Node thì không tự làm. */
const quoteArg = (value) => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : String(value));

/**
 * Chạy một lệnh, in thẳng ra màn hình.
 *
 * `shell: true` chỉ dùng cho file .bat (Gradle và npm), vì Windows không chạy
 * .bat trực tiếp được. Node có sẵn tuỳ chọn `shell` nhưng nó ghép tham số mà
 * không bọc nháy, nên đường dẫn của repo này ("D:\Coding\web film\...") bị cắt
 * làm đôi. Tự gọi cmd.exe với cả dòng lệnh đã bọc nháy là cách duy nhất đi qua
 * được dấu cách mà không phải viết lại quy tắc quote của cmd.
 */
function runTool(command, args, { env, cwd = ROOT, shell = false } = {}) {
  const options = { stdio: 'inherit', cwd, env: { ...process.env, ...env } };
  if (shell && WIN) {
    // `@echo off&` để file .bat không in lại từng dòng của chính nó: gradle.bat
    // chỉ tự tắt echo khi biến DEBUG trống, mà biến đó có thể đang được đặt sẵn
    // trong môi trường của người dùng vì lý do chẳng liên quan gì tới build.
    const line = `"@echo off& ${[command, ...args].map(quoteArg).join(' ')}"`;
    const result = spawnSync('cmd.exe', ['/d', '/s', '/c', line], { ...options, windowsVerbatimArguments: true });
    if (result.error) fail(`Không chạy được ${command}: ${result.error.message}`);
    if (result.status !== 0) fail(`${command} kết thúc với mã ${result.status}.`);
    return;
  }
  const result = spawnSync(command, args, options);
  if (result.error) fail(`Không chạy được ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} kết thúc với mã ${result.status}.`);
}

// ---- Tham số --------------------------------------------------------------

const options = { apiBase: null, lan: false, apiHost: null, install: false, debug: false, web: true, device: null };

function usage(code) {
  console.log(`
Đóng gói app Android cho BảoNhànCinema.

  build-apk.cmd                    API production -> android-out\\BaoNhanCinema.apk
  build-apk.cmd install             gói xong cài luôn lên thiết bị đang nối adb
  build-apk.cmd lan                 API = http://<IP LAN của máy này>:4000/api
  build-apk.cmd lan 192.168.1.20    API ở đúng địa chỉ đó
  build-apk.cmd api https://x/api   API bất kỳ
  build-apk.cmd debug               bản debug thay vì bản release có ký
  build-apk.cmd --no-web            dùng lại apps/web/dist, không build web lại
  build-apk.cmd --device <serial>   chọn thiết bị khi adb thấy nhiều máy
`);
  process.exit(code);
}

function parseArgs(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h' || arg === 'help') usage(0);
    if (arg === '--api') { options.apiBase = argv[++index]; continue; }
    if (arg === '--lan' || arg === 'lan') {
      options.lan = true;
      // IP là tùy chọn: không đưa thì tự dò địa chỉ LAN của máy này.
      if (argv[index + 1] && !argv[index + 1].startsWith('-')) options.apiHost = argv[++index];
      continue;
    }
    if (arg === '--install' || arg === 'install') { options.install = true; continue; }
    if (arg === '--debug' || arg === 'debug') { options.debug = true; continue; }
    if (arg === '--no-web') { options.web = false; continue; }
    if (arg === '--device') { options.device = argv[++index]; continue; }
    fail(`Không hiểu tham số "${arg}". Chạy "build-apk.cmd help" để xem cách dùng.`);
  }
}

// ---- Công cụ --------------------------------------------------------------

/** JDK 17: cặp Gradle 8.9 + AGP 8.7 không chạy được với JDK 23 đang có trên máy. */
function findJdk() {
  const home = join(ROOT, '.tools', 'jdk17');
  const found = findJavaHome(home);
  if (found) return found;

  const zip = join(ROOT, '.tools', 'downloads', 'jdk17.zip');
  if (!existsSync(zip)) return null;
  log('   Chưa có JDK 17, giải nén .tools/downloads/jdk17.zip (một lần, ~190 MB)…');
  mkdirSync(home, { recursive: true });
  runTool('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${home}' -Force`]);
  return findJavaHome(home);
}

/** Zip của JDK có một thư mục bao ngoài, nên phải tìm `bin\java.exe` ở hai mức. */
function findJavaHome(base) {
  if (existsSync(join(base, 'bin', 'java.exe'))) return base;
  if (!existsSync(base)) return null;
  for (const entry of readdirSync(base)) {
    const nested = join(base, entry);
    if (existsSync(join(nested, 'bin', 'java.exe'))) return nested;
  }
  return null;
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null
  ].filter(Boolean);
  for (const candidate of candidates) if (existsSync(join(candidate, 'platform-tools'))) return candidate;
  return null;
}

function findGradle() {
  const bundled = join(ROOT, '.tools', 'gradle-8.9', 'bin', 'gradle.bat');
  if (existsSync(bundled)) return bundled;
  // Bản trong git để CI (và máy khác) chạy được mà không cần .tools/.
  const wrapper = join(ANDROID_DIR, 'gradlew.bat');
  if (existsSync(wrapper)) return wrapper;
  return null;
}

// ---- Chọn API --------------------------------------------------------------

/** API nhét vào bản build. Ưu tiên: tham số dòng lệnh -> .env -> mặc định. */
function resolveApiBase() {
  if (options.apiBase) return options.apiBase.replace(/\/+$/, '');
  if (options.lan) {
    const host = options.apiHost ?? detectLanIp();
    if (!host) fail('Không dò được IP LAN của máy này. Chạy lại với địa chỉ cụ thể: build-apk.cmd lan 192.168.1.20');
    return `http://${host}:4000/api`;
  }
  const fromEnv = readEnvApiBase();
  if (fromEnv) return fromEnv;
  log(`   .env không có VITE_API_URL tuyệt đối, dùng mặc định ${FALLBACK_API}`);
  return FALLBACK_API;
}

/**
 * Đọc VITE_API_URL từ .env ở gốc repo.
 *
 * Giá trị tương đối ('/api') bị bỏ qua: nó đúng cho dev server có proxy, còn
 * trong APK thì không có proxy nào nên mọi request sẽ đi vào hư không.
 */
function readEnvApiBase() {
  try {
    const line = readFileSync(join(ROOT, '.env'), 'utf8')
      .split(/\r?\n/)
      .find((row) => /^VITE_API_URL\s*=/.test(row));
    if (!line) return null;
    const value = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
    return value.startsWith('http') ? value.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

/** Địa chỉ LAN của máy này, để API chạy trên chính nó vẫn gọi được từ điện thoại. */
function detectLanIp() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)) return address.address;
    }
  }
  return null;
}

// ---- Các bước -------------------------------------------------------------

function buildWeb(apiBase) {
  log(`   VITE_API_URL=${apiBase}`);
  const args = ['run', 'build', '--workspace', 'apps/web'];
  const env = { VITE_API_URL: apiBase };
  const nodeExe = join(ROOT, '.tools', 'node', 'node.exe');
  const npmCli = join(ROOT, '.tools', 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (existsSync(nodeExe) && existsSync(npmCli)) runTool(nodeExe, [npmCli, ...args], { env });
  else runTool('npm', args, { env, shell: true });
}

/** Chép bản build web vào assets của APK — đây là bước biến APK thành app local. */
function syncWebAssets() {
  if (!existsSync(join(DIST_WEB, 'index.html'))) {
    fail('Không thấy apps/web/dist/index.html. Bỏ --no-web, hoặc build web trước bằng "npm run build --workspace apps/web".');
  }
  if (!ASSETS_WEB.startsWith(ANDROID_DIR)) fail(`Đường dẫn assets nằm ngoài android/: ${ASSETS_WEB}`);
  rmSync(ASSETS_WEB, { recursive: true, force: true });
  mkdirSync(ASSETS_WEB, { recursive: true });
  cpSync(DIST_WEB, ASSETS_WEB, { recursive: true });
  log(`   Đã chép apps/web/dist -> ${ASSETS_WEB.replace(ROOT, '.')}`);
}

/**
 * Khoá ký APK: sinh một lần rồi giữ lại.
 *
 * Android nhận ra một app bằng chữ ký chứ không bằng tên. Mất file này thì bản
 * cài mới bị coi là app khác: phải gỡ bản cũ trước, và mất theo toàn bộ dữ liệu
 * trong app (máy chủ đã chọn, chủ đề, lịch sử xem). Nó đã được gitignore — sao
 * lưu riêng là việc của người dùng.
 */
function ensureKeystore(jdkHome) {
  const properties = join(ANDROID_DIR, 'keystore.properties');
  const store = join(ANDROID_DIR, 'keystore.jks');
  if (existsSync(properties) && existsSync(store)) {
    log('   Đã có android\\keystore.jks, dùng lại.');
    return;
  }
  log('   Chưa có khoá ký — tạo mới (các lần sau dùng lại chính khoá này).');
  const keytool = jdkHome ? join(jdkHome, 'bin', 'keytool.exe') : 'keytool';
  const password = randomBytes(15).toString('base64url');
  runTool(keytool, [
    '-genkeypair',
    '-keystore', store,
    '-alias', 'baonhancinema',
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '10000',
    '-storepass', password,
    '-keypass', password,
    '-dname', 'CN=BaoNhanCinema, OU=local app, O=BaoNhanCinema, C=VN'
  ]);
  writeFileSync(properties, [
    'storeFile=keystore.jks',
    `storePassword=${password}`,
    'keyAlias=baonhancinema',
    `keyPassword=${password}`,
    ''
  ].join('\n'));
}

function runGradle(gradle, { jdkHome, sdk, apiBase }) {
  // local.properties là cách Gradle chuẩn để biết SDK nằm ở đâu; ANDROID_HOME chỉ
  // là phương án dự phòng.
  writeFileSync(join(ANDROID_DIR, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '\\\\')}\n`);
  runTool(gradle, [
    '--project-dir', ANDROID_DIR,
    `-PapiBase=${apiBase}`,
    options.debug ? 'assembleDebug' : 'assembleRelease'
  ], {
    env: { JAVA_HOME: jdkHome ?? process.env.JAVA_HOME ?? '', ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
    shell: true
  });
}

function copyApk() {
  const variant = options.debug ? 'debug' : 'release';
  const name = options.debug ? 'app-debug.apk' : 'app-release.apk';
  const built = join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', variant, name);
  if (!existsSync(built)) fail(`Gradle chạy xong nhưng không thấy ${built}`);
  mkdirSync(OUT_DIR, { recursive: true });
  copyFileSync(built, OUT_APK);
}

function adbPath(sdk) {
  return join(sdk, 'platform-tools', 'adb.exe');
}

function connectedDevices(adb) {
  const output = execFileSync(adb, ['devices'], { encoding: 'utf8' });
  return output.split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 2 && parts[1] === 'device')
    .map((parts) => parts[0]);
}

function installToDevice(sdk) {
  const adb = adbPath(sdk);
  if (!existsSync(adb)) fail(`Không thấy adb trong ${adb}`);
  const devices = connectedDevices(adb);
  if (devices.length === 0) {
    fail('Không thấy thiết bị nào. Điện thoại: bật "Gỡ lỗi USB" rồi cắm cáp. '
      + 'TV box: bật "Gỡ lỗi ADB" trong phần giới thiệu, rồi chạy "adb connect <ip>:5555".');
  }
  const target = options.device ?? (devices.length === 1 ? devices[0] : null);
  if (!target) fail(`Có nhiều thiết bị (${devices.join(', ')}). Chọn một cái bằng --device <serial>.`);
  log(`   Cài lên ${target}…`);
  runTool(adb, ['-s', target, 'install', '-r', OUT_APK]);
  log('   Xong. Mở app "BảoNhànCinema" trên thiết bị.');
}

// ---- Chạy -----------------------------------------------------------------

parseArgs(process.argv.slice(2));

step('[1/6] Kiểm tra công cụ');
const jdkHome = findJdk();
if (!jdkHome) fail('Không thấy JDK 17. Cần .tools/downloads/jdk17.zip, hoặc đặt JAVA_HOME trỏ vào một JDK 17.');
const sdk = findAndroidSdk();
if (!sdk) fail('Không thấy Android SDK. Đặt ANDROID_HOME, hoặc cài SDK qua Android Studio.');
const gradle = findGradle();
if (!gradle) fail('Không thấy Gradle. Cần .tools/gradle-8.9 hoặc android/gradlew.bat.');
log(`   JDK:    ${jdkHome}`);
log(`   SDK:    ${sdk}`);
log(`   Gradle: ${gradle}`);

const apiBase = resolveApiBase();

step('[2/6] Build web');
if (options.web) buildWeb(apiBase);
else log('   Bỏ qua vì có --no-web, dùng lại apps/web/dist.');
syncWebAssets();

step('[3/6] Khoá ký APK');
ensureKeystore(jdkHome);

step(options.debug ? '[4/6] Gradle assembleDebug' : '[4/6] Gradle assembleRelease');
runGradle(gradle, { jdkHome, sdk, apiBase });

step('[5/6] Lấy APK');
copyApk();
log(`   ${OUT_APK}  (${(statSync(OUT_APK).size / 1024 / 1024).toFixed(1)} MB)`);

step('[6/6] Cài lên thiết bị');
if (options.install) installToDevice(sdk);
else {
  log('   Bỏ qua. Muốn cài ngay: build-apk.cmd install');
  log(`   Hoặc tự cài: "${adbPath(sdk)}" install -r "${OUT_APK}"`);
  log('   Hoặc chép file .apk vào điện thoại / TV box rồi mở bằng trình quản lý file.');
}

console.log(`
==========================================================
 APK: ${OUT_APK}
 API: ${apiBase}

 Đổi máy chủ API ngay trong app (không cần build lại):
   - bấm nút "Máy chủ" trên header (chỉ hiện khi chạy trong app Android), hoặc
   - giữ nút Back khoảng 1 giây.
==========================================================
`);
