/**
 * Proxy playlist HLS: lấy .m3u8 của nguồn, bóc quảng cáo (xem `hls.ts`) rồi trả
 * lại cho player.
 *
 * Chỉ có **playlist** đi qua máy chủ này — vài KB mỗi lần. Segment .ts và key
 * được ghi lại thành URL tuyệt đối trỏ thẳng CDN của nguồn, nên băng thông
 * Railway không đổi và CORS vẫn đúng như khi player gọi trực tiếp.
 *
 * Vì sao lọc ở máy chủ chứ không ở trình duyệt: bản web trên iOS/Safari và app TV
 * LG phát HLS bằng player gốc của hệ thống, không qua hls.js nên không chèn được
 * bộ lọc vào giữa. Sửa ở máy chủ thì mọi thiết bị đều nhận playlist đã sạch.
 *
 * SSRF: route chính chỉ nhận `episodeId` rồi tự đọc URL từ DB. Playlist con (khi
 * nguồn dùng master playlist) đi qua `/hls` với chữ ký HMAC do chính máy chủ này
 * phát ra, cộng thêm chặn địa chỉ nội bộ — không có đường nào để bên ngoài bắt
 * API gọi tới một URL tuỳ ý.
 */
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import express from 'express';
import { z } from 'zod';
import { getEpisodes } from './db.js';
import { httpError } from './errors.js';
import { filterPlaylist, type AdFilterReport } from './hls.js';
import { asyncRoute } from './http.js';

const MAX_PLAYLIST_BYTES = 4 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;
const CACHE_LIMIT = 300;
/**
 * Đặt STREAM_SECRET nếu chạy nhiều instance API (hoặc muốn link con sống qua lần
 * restart); không đặt thì mỗi tiến trình tự sinh, link con của tiến trình cũ hết
 * hiệu lực — player rơi xuống bậc dự phòng và tải lại, không vỡ gì.
 */
const secret = process.env.STREAM_SECRET ?? crypto.randomBytes(32).toString('hex');

const idSchema = z.coerce.number().int().positive();

export const streamRouter = express.Router();

const sign = (url: string) => crypto.createHmac('sha256', secret).update(url).digest('base64url');

function verify(url: string, signature: string) {
  const expected = Buffer.from(sign(url));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Link tương đối cùng origin với playlist cha nên player tự resolve đúng. */
const proxyUrl = (url: string) => `/api/stream/hls?u=${encodeURIComponent(Buffer.from(url).toString('base64url'))}&s=${sign(url)}`;

/** Dải IPv4 nội bộ/metadata — không cho proxy chạm vào hạ tầng của chính mình. */
const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^192\.0\.0\./, /^198\.1[89]\./
];

function isPrivateAddress(address: string) {
  if (net.isIPv4(address)) return PRIVATE_V4.some((range) => range.test(address));
  const value = address.toLowerCase();
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd')
    || value.startsWith('fe80') || value.startsWith('::ffff:127.') || value.startsWith('::ffff:10.');
}

/** Tên miền không phân giải được là lỗi của nguồn, không phải của người gọi. */
async function resolveHost(hostname: string) {
  try {
    return await dns.lookup(hostname, { all: true });
  } catch {
    throw httpError(502, 'Không phân giải được tên miền của nguồn');
  }
}

async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw httpError(400, 'Chỉ nhận http/https');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(hostname) ? [{ address: hostname }] : await resolveHost(hostname);
  if (!addresses.length) throw httpError(502, 'Không phân giải được tên miền của nguồn');
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw httpError(400, 'Địa chỉ nội bộ bị chặn');
  return url;
}

/** Đọc theo chunk có chặn trần: nguồn lỗi trả body vô tận thì không kéo sập API. */
async function readCapped(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PLAYLIST_BYTES) { await reader.cancel(); throw httpError(502, 'Playlist của nguồn quá lớn'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchPlaylist(url: string) {
  await assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    // Nhiều CDN phim chặn hotlink: thiếu Referer/User-Agent là trả 403.
    const origin = new URL(url).origin;
    const response = await fetch(url, {
      signal: controller.signal, redirect: 'follow',
      headers: {
        accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        referer: `${origin}/`
      }
    });
    if (!response.ok) throw httpError(502, `Nguồn trả HTTP ${response.status}`);
    // response.url là URL sau redirect — phải dùng nó làm base, không thì đường
    // dẫn tương đối trong playlist sẽ resolve về host cũ.
    return { text: await readCapped(response), finalUrl: response.url || url };
  } finally { clearTimeout(timer); }
}

interface CacheEntry { expires: number; playlist: string; report: AdFilterReport }
const cache = new Map<string, CacheEntry>();

function cached(url: string) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (entry.expires <= Date.now()) { cache.delete(url); return null; }
  return entry;
}

function remember(url: string, entry: CacheEntry) {
  cache.set(url, entry);
  // Map giữ thứ tự chèn nên key đầu tiên là cũ nhất.
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}

async function loadPlaylist(url: string) {
  const hit = cached(url);
  if (hit) return hit;
  const { text, finalUrl } = await fetchPlaylist(url);
  const { playlist, report } = filterPlaylist(text, finalUrl, proxyUrl);
  if (report.segments.removed) {
    console.log(`[stream] bỏ ${report.segments.removed} segment (~${report.duration.removed}s) quảng cáo: ${url}`);
  }
  // VOD thì playlist không đổi nữa, cache thoải mái; live phải làm mới liên tục.
  const entry: CacheEntry = { expires: Date.now() + (report.vod ? 300_000 : 15_000), playlist, report };
  remember(url, entry);
  return entry;
}

function sendPlaylist(res: express.Response, entry: CacheEntry) {
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  res.setHeader('Cache-Control', entry.report.vod ? 'public, max-age=300' : 'public, max-age=15');
  res.setHeader('X-Ads-Removed', String(entry.report.segments.removed));
  res.setHeader('X-Ads-Removed-Seconds', String(entry.report.duration.removed));
  res.setHeader('Access-Control-Expose-Headers', 'X-Ads-Removed, X-Ads-Removed-Seconds');
  res.send(entry.playlist);
}

async function episodeStreamUrl(rawId: unknown) {
  const episode = await getEpisodes(idSchema.parse(rawId));
  if (!episode) throw httpError(404, 'Không tìm thấy tập phim');
  if (!episode.m3u8Url) throw httpError(404, 'Tập này chỉ có trang nhúng, không có m3u8');
  return episode.m3u8Url;
}

/** Nguồn chính của player. Đường dẫn kết thúc .m3u8 để player gốc nhận đúng kiểu. */
streamRouter.get('/episode/:id/playlist.m3u8', asyncRoute(async (req, res) => {
  sendPlaylist(res, await loadPlaylist(await episodeStreamUrl(req.params.id)));
}));

/**
 * Soi xem bộ lọc quyết định thế nào trên một tập cụ thể: từng block, chữ ký, thời
 * lượng, lý do bị cắt. `?raw=1` kèm luôn playlist gốc để đối chiếu khi nguồn đổi
 * cách chèn quảng cáo.
 */
streamRouter.get('/episode/:id/report', asyncRoute(async (req, res) => {
  const url = await episodeStreamUrl(req.params.id);
  const entry = await loadPlaylist(url);
  const raw = req.query.raw === '1' ? (await fetchPlaylist(url)).text.slice(0, 8_000) : undefined;
  res.json({ upstream: url, report: entry.report, filtered: entry.playlist.slice(0, 8_000), raw });
}));

/** Playlist con của master playlist — chỉ nhận URL do chính máy chủ này ký. */
streamRouter.get('/hls', asyncRoute(async (req, res) => {
  const query = z.object({ u: z.string().min(1).max(4_000), s: z.string().min(1).max(200) }).parse(req.query);
  const url = Buffer.from(query.u, 'base64url').toString('utf8');
  if (!verify(url, query.s)) throw httpError(403, 'Link không hợp lệ hoặc đã hết hiệu lực');
  sendPlaylist(res, await loadPlaylist(url));
}));
