/**
 * Bộ lọc quảng cáo m3u8 — test trên playlist tự dựng, không cần mạng.
 *
 * Chạy bằng test runner có sẵn của Node (`npm test`), import từ `dist/` nên không
 * thêm dependency nào cho một service chỉ cần deploy.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterPlaylist } from '../dist/hls.js';

const BASE = 'https://cdn.example.com/film/abc/index.m3u8';
const FILM = 'https://cdn.example.com/film/abc';
const proxy = (url) => `/api/stream/hls?u=${encodeURIComponent(url)}`;
const run = (text, base = BASE) => filterPlaylist(text, base, proxy);
const uris = (playlist) => playlist.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
const seg = (duration, uri) => [`#EXTINF:${duration.toFixed(3)},`, uri];

const media = (...body) => [
  '#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:6', '#EXT-X-MEDIA-SEQUENCE:0',
  '#EXT-X-PLAYLIST-TYPE:VOD', ...body, '#EXT-X-ENDLIST'
].join('\n');

test('bỏ pre-roll chèn từ CDN khác', () => {
  const { playlist, report } = run(media(
    ...seg(5, 'https://ads.example.com/preroll/ad1.ts'),
    ...seg(5, 'https://ads.example.com/preroll/ad2.ts'),
    ...seg(5, 'https://ads.example.com/preroll/ad3.ts'),
    '#EXT-X-DISCONTINUITY',
    ...seg(10, 'seg1.ts'), ...seg(10, 'seg2.ts'), ...seg(10, 'seg3.ts'), ...seg(10, 'seg4.ts')
  ));
  assert.deepEqual(uris(playlist), [1, 2, 3, 4].map((n) => `${FILM}/seg${n}.ts`));
  assert.equal(report.segments.removed, 3);
  assert.equal(report.duration.removed, 15);
  assert.equal(report.vod, true);
  // Dấu ngắt của quảng cáo phải đi theo quảng cáo, không được sót lại.
  assert.ok(!playlist.includes('#EXT-X-DISCONTINUITY'));
  assert.ok(playlist.includes('#EXT-X-TARGETDURATION:10'));
  assert.ok(playlist.includes('#EXT-X-MEDIA-SEQUENCE:3'));
  assert.ok(playlist.includes('#EXT-X-PLAYLIST-TYPE:VOD'));
  assert.ok(playlist.trimEnd().endsWith('#EXT-X-ENDLIST'));
});

test('bỏ block giữa phim, hai nửa phim nối liền không còn dấu ngắt', () => {
  // Tên file quảng cáo cố tình vô can: chỉ quy tắc chữ ký mới bắt được block này,
  // và phần phim bị chẻ làm hai nên phải gộp theo chữ ký mới đủ quá bán.
  const { playlist, report } = run(media(
    ...seg(10, 'a1.ts'), ...seg(10, 'a2.ts'), ...seg(10, 'a3.ts'),
    '#EXT-X-DISCONTINUITY',
    ...seg(6, 'https://spots.example.net/media/clip1.ts'),
    ...seg(6, 'https://spots.example.net/media/clip2.ts'),
    '#EXT-X-DISCONTINUITY',
    ...seg(10, 'b1.ts'), ...seg(10, 'b2.ts'), ...seg(10, 'b3.ts')
  ));
  assert.deepEqual(uris(playlist), ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((n) => `${FILM}/${n}.ts`));
  assert.equal(report.groups[1].verdict, 'khác nguồn với phần phim');
  assert.ok(!playlist.includes('#EXT-X-DISCONTINUITY'));
});

test('bỏ ad break khai bằng CUE-OUT dù cùng CDN với phim', () => {
  const { playlist, report } = run(media(
    ...seg(10, 'a1.ts'), ...seg(10, 'a2.ts'),
    '#EXT-X-CUE-OUT:12.000',
    ...seg(6, 'filler1.ts'), ...seg(6, 'filler2.ts'),
    '#EXT-X-CUE-IN',
    ...seg(10, 'b1.ts')
  ));
  assert.deepEqual(uris(playlist), ['a1', 'a2', 'b1'].map((n) => `${FILM}/${n}.ts`));
  assert.equal(report.groups[1].verdict, 'ad break (CUE-OUT)');
  assert.ok(!playlist.includes('#EXT-X-CUE-OUT'));
});

test('playlist sạch thì không chạm vào segment nào', () => {
  const { playlist, report } = run(media(...seg(10, 's1.ts'), ...seg(10, 's2.ts'), ...seg(9.5, 's3.ts')));
  assert.equal(report.segments.removed, 0);
  assert.deepEqual(uris(playlist), ['s1', 's2', 's3'].map((n) => `${FILM}/${n}.ts`));
  assert.ok(playlist.includes('#EXT-X-TARGETDURATION:10'));
});

test('quảng cáo dùng key AES riêng: phần phim vẫn giữ đúng key của nó', () => {
  const { playlist } = run(media(
    '#EXT-X-KEY:METHOD=AES-128,URI="https://ads.example.com/spot/ad.key",IV=0x1',
    ...seg(5, 'https://ads.example.com/spot/ad1.ts'),
    '#EXT-X-DISCONTINUITY',
    '#EXT-X-KEY:METHOD=AES-128,URI="film.key",IV=0x2',
    ...seg(10, 's1.ts'), ...seg(10, 's2.ts'), ...seg(10, 's3.ts')
  ));
  assert.ok(!playlist.includes('ad.key'));
  assert.ok(playlist.includes(`#EXT-X-KEY:METHOD=AES-128,URI="${FILM}/film.key",IV=0x2`));
  assert.equal(uris(playlist).length, 3);
});

test('fMP4: init segment của phim được giữ, của quảng cáo bị bỏ', () => {
  const { playlist } = run(media(
    '#EXT-X-MAP:URI="https://ads.example.com/spot/init.mp4"',
    ...seg(5, 'https://ads.example.com/spot/ad1.m4s'),
    '#EXT-X-DISCONTINUITY',
    '#EXT-X-MAP:URI="init.mp4"',
    ...seg(10, 's1.m4s'), ...seg(10, 's2.m4s'), ...seg(10, 's3.m4s')
  ));
  assert.ok(!playlist.includes('spot/init.mp4'));
  assert.ok(playlist.includes(`#EXT-X-MAP:URI="${FILM}/init.mp4"`));
});

test('master playlist: variant đi tiếp qua proxy, không cắt gì', () => {
  const { playlist, report } = run([
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360',
    '360/index.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720',
    `${FILM}/720/index.m3u8`
  ].join('\n'));
  assert.equal(report.kind, 'master');
  assert.deepEqual(uris(playlist), [proxy(`${FILM}/360/index.m3u8`), proxy(`${FILM}/720/index.m3u8`)]);
});

test('không bao giờ xoá hết: mọi block đều giống quảng cáo thì giữ block dài nhất', () => {
  const { playlist, report } = run(media(
    ...seg(5, 'https://x.example.com/ads/a1.ts'),
    '#EXT-X-DISCONTINUITY',
    ...seg(10, 'https://y.example.com/ads/b1.ts'), ...seg(10, 'https://y.example.com/ads/b2.ts')
  ));
  assert.equal(uris(playlist).length, 2);
  assert.equal(report.segments.removed, 1);
});

test('không cắt oan đường dẫn chứa "adaptive"/"download"', () => {
  const { report } = run(media(
    ...seg(10, 'https://cdn.example.com/adaptive/download-adaptive-1.ts'),
    '#EXT-X-DISCONTINUITY',
    ...seg(10, 'https://cdn.example.com/adaptive/download-adaptive-2.ts')
  ));
  assert.equal(report.segments.removed, 0);
});

test('playlist không nhận dạng được thì trả về nguyên văn', () => {
  const text = '#EXTM3U\n#EXT-X-VERSION:3\n';
  assert.equal(run(text).playlist, text);
});
