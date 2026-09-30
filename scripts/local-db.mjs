#!/usr/bin/env node
/**
 * Cụm PostgreSQL chạy tại chỗ cho lúc dev — không cần Docker, không cần tài khoản
 * Supabase, không đụng tới service PostgreSQL nào đã cài sẵn trên máy.
 *
 * Vì sao cần: `npm run dev` trước đây trỏ thẳng vào Supabase. Supabase free tier
 * tự ngủ, project bị xoá hay đổi region là API rơi vào vòng retry vô tận
 * (`Database init failed (lần n)`) trong khi web vẫn hiện "API ngoại tuyến". Một
 * cụm Postgres nằm trong `.tools/pgdata` (đã có trong .gitignore) làm cho việc
 * dev không phụ thuộc dịch vụ ngoài, còn muốn dùng Supabase thật thì chỉ cần
 * đổi `DATABASE_URL` — script tự bỏ qua khi thấy URL không trỏ về máy này.
 *
 * Dùng binary PostgreSQL có sẵn trên máy (initdb/pg_ctl), cổng 55432 để không
 * đụng cổng 5432 của service hệ thống. Dữ liệu nằm ở `.tools/pgdata`, xoá cả
 * thư mục đó là về lại trạng thái trắng.
 *
 *   node scripts/local-db.mjs start    # tạo (lần đầu) và bật cụm, tạo database
 *   node scripts/local-db.mjs stop     # tắt cụm (dữ liệu vẫn còn)
 *   node scripts/local-db.mjs status   # đang chạy hay không
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, '.tools', 'pgdata');
const LOG_FILE = path.join(ROOT, '.tools', 'postgres.log');
const PORT = Number(process.env.LOCAL_DB_PORT ?? 55432);
const DB_NAME = process.env.LOCAL_DB_NAME ?? 'cinema';
const DB_USER = 'postgres';
const START_TIMEOUT_MS = 30_000;

/** Tìm thư mục `bin` của PostgreSQL: PGBIN, rồi bản mới nhất trong Program Files. */
function findBinDir() {
  const candidates = [];
  if (process.env.PGBIN) candidates.push({ version: [999], dir: process.env.PGBIN });
  for (const home of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (!home) continue;
    const root = path.join(home, 'PostgreSQL');
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      const dir = path.join(root, entry, 'bin');
      if (!fs.existsSync(path.join(dir, 'initdb.exe')) && !fs.existsSync(path.join(dir, 'initdb'))) continue;
      candidates.push({ version: entry.split('.').map((part) => Number(part) || 0), dir });
    }
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < Math.max(a.version.length, b.version.length); i += 1) {
      const diff = (b.version[i] ?? 0) - (a.version[i] ?? 0);
      if (diff) return diff;
    }
    return 0;
  });
  return candidates[0]?.dir ?? null;
}

const BIN = findBinDir();
const exe = (name) => path.join(BIN ?? '', process.platform === 'win32' ? `${name}.exe` : name);

/** Đọc một biến từ .env mà không cần dotenv (script chạy trước cả API). */
function readEnvValue(key) {
  for (const file of ['services/api/.env', '.env']) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match && match[1] === key) return match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

const databaseUrl = process.env.DATABASE_URL ?? readEnvValue('DATABASE_URL');

/**
 * Repo không chứa `.env` (bị .gitignore), mà `db.ts` ném lỗi ngay lúc import khi
 * thiếu `DATABASE_URL` — API sẽ chết trước khi kịp phục vụ catalog. Máy mới clone
 * chỉ cần `npm run dev`: lấy `.env.example` (đã trỏ sẵn vào cụm local) làm mặc định.
 */
function ensureEnvFile() {
  const envFile = path.join(ROOT, 'services', 'api', '.env');
  if (fs.existsSync(envFile)) return;
  const example = path.join(ROOT, '.env.example');
  if (!fs.existsSync(example)) return;
  fs.copyFileSync(example, envFile);
  console.log('[db] chưa có services/api/.env — đã tạo từ .env.example (trỏ vào cụm local).');
}

/** URL trỏ về máy này thì mới cần cụm local; Supabase/Railway thì để yên. */
function isLocalUrl(url) {
  if (!url) return true;
  try {
    return /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

function run(name, args, options = {}) {
  const result = spawnSync(exe(name), args, { encoding: 'utf8', ...options });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: PORT });
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(1_000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function waitForPort() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await portOpen()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

/**
 * `initdb` một lần, rồi ghim cổng vào `postgresql.auto.conf` — file mà chính
 * PostgreSQL dùng cho cấu hình ghi đè, nên ghi lại mỗi lần start là an toàn và
 * `LOCAL_DB_PORT` đổi lúc nào cũng có tác dụng.
 */
function initIfNeeded() {
  const fresh = !fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
  if (fresh) {
    fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true });
    console.log(`[db] tạo cụm PostgreSQL mới ở ${path.relative(ROOT, DATA_DIR)} ...`);
    const created = run('initdb', ['-D', DATA_DIR, '-U', DB_USER, '--auth=trust', '-E', 'UTF8']);
    if (!created.ok) throw new Error(`initdb thất bại:\n${created.output}`);
  }
  fs.writeFileSync(path.join(DATA_DIR, 'postgresql.auto.conf'), [
    '# Ghi bởi scripts/local-db.mjs — cụm dev của BảoNhànCinema, không sửa tay.',
    `port = ${PORT}`,
    "listen_addresses = '127.0.0.1'",
    ''
  ].join('\n'));
}

function clusterRunning() {
  return run('pg_ctl', ['-D', DATA_DIR, 'status']).ok;
}

/** Bật cụm rồi chờ nó nhận kết nối; tách khỏi tiến trình này để Ctrl+C của `npm run dev` không giết nó. */
async function start() {
  if (!BIN) {
    console.error('[db] không tìm thấy PostgreSQL. Cài PostgreSQL 14+ (postgresql.org/download), hoặc đặt PGBIN trỏ tới thư mục bin.');
    process.exitCode = 1;
    return;
  }
  if (clusterRunning()) {
    console.log(`[db] cụm local đang chạy ở cổng ${PORT}.`);
  } else {
    initIfNeeded();
    const child = spawn(exe('pg_ctl'), ['-D', DATA_DIR, '-l', LOG_FILE, 'start'], {
      detached: true, stdio: 'ignore', windowsHide: true
    });
    child.unref();
    if (!(await waitForPort())) {
      console.error(`[db] cụm không mở cổng ${PORT} sau ${START_TIMEOUT_MS / 1000}s. Xem log: ${path.relative(ROOT, LOG_FILE)}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[db] đã bật PostgreSQL local ở cổng ${PORT}.`);
  }
  ensureDatabase();
  console.log(`[db] sẵn sàng: postgresql://${DB_USER}@127.0.0.1:${PORT}/${DB_NAME}`);
}

function ensureDatabase() {
  const exists = run('psql', ['-h', '127.0.0.1', '-p', String(PORT), '-U', DB_USER, '-d', 'postgres', '-tAc',
    `SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'`]);
  if (exists.output.includes('1')) return;
  const created = run('createdb', ['-h', '127.0.0.1', '-p', String(PORT), '-U', DB_USER, DB_NAME]);
  if (!created.ok) throw new Error(`createdb thất bại:\n${created.output}`);
  console.log(`[db] đã tạo database "${DB_NAME}".`);
}

function stop() {
  if (!clusterRunning()) {
    console.log('[db] cụm local không chạy.');
    return;
  }
  const result = run('pg_ctl', ['-D', DATA_DIR, '-m', 'fast', 'stop']);
  console.log(result.ok ? '[db] đã tắt cụm local (dữ liệu vẫn còn trong .tools/pgdata).' : `[db] không tắt được:\n${result.output}`);
  if (!result.ok) process.exitCode = 1;
}

function status() {
  console.log(clusterRunning()
    ? `[db] đang chạy: postgresql://${DB_USER}@127.0.0.1:${PORT}/${DB_NAME}`
    : '[db] không chạy.');
}

const command = process.argv[2] ?? 'start';
if (command === 'start') {
  ensureEnvFile();
  if (!isLocalUrl(databaseUrl)) {
    console.log('[db] DATABASE_URL trỏ ra ngoài máy (Supabase/Railway) — bỏ qua cụm local.');
  } else {
    await start();
  }
} else if (command === 'stop') {
  stop();
} else if (command === 'status') {
  status();
} else {
  console.error(`Lệnh không hợp lệ: ${command}. Dùng start | stop | status.`);
  process.exitCode = 1;
}
