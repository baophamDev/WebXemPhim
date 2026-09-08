/**
 * Bộ chuyển phụ đề — `apps/web/src/subs/convert.ts`.
 *
 * Vì sao phần này phải có test: phụ đề hỏng theo kiểu **im lặng**. WebVTT sai một chỗ
 * thì player không báo lỗi, nó chỉ không hiện cue đó — mà một file sub có hai nghìn
 * cue thì mất vài cái không ai thấy. Mọi assert dưới đây đều là một cách mất chữ đã
 * gặp thật, không phải giả định:
 *
 * - dòng trắng giữa hai dòng thoại của cùng một cue: WebVTT coi dòng trắng là **hết
 *   cue**, nên nửa sau câu biến mất;
 * - `a < b` trong thoại: WebVTT đọc `<` là mở thẻ và ăn hết phần còn lại của dòng;
 * - `<font color>` của SRT: không phải thẻ WebVTT, để nguyên thì thành khoảng trắng;
 * - số thứ tự block của SRT: nếu cắt bằng "dòng nào chỉ có số" thì câu thoại "Năm
 *   1995" cũng bị cắt;
 * - ASS thiếu cột `Layer` (bản SSA cũ): đọc cột theo vị trí cố định là lệch hết mốc
 *   thời gian.
 *
 * Cách chạy TypeScript ở đây giống `boot.test.mjs`: transpile bằng chính `typescript`
 * của repo rồi `new Function`. `convert.ts` cố ý không chạm DOM và không fetch nên
 * không cần jsdom — chuỗi vào, chuỗi ra.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(import.meta.url)('typescript');
const js = ts.transpileModule(readFileSync(resolve(app, 'src/subs/convert.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const box = { exports: {} };
new Function('exports', 'module', js)(box.exports, box);
const {
  decodeSubtitle, detectFormat, formatStamp, parseStamp, toVtt, shiftVtt,
  cueCount, base64ToBytes, guessTrackMeta, episodeHint, prepareSubtitle
} = box.exports;

const bytes = (text) => new TextEncoder().encode(text);
/** Cue thứ n (0-based) của một file VTT: `[timing, ...dòng thoại]`. */
function cueAt(vtt, index) {
  const block = vtt.split('\n\n').slice(1).map((part) => part.trim()).filter(Boolean)[index];
  return block ? block.split('\n') : [];
}

test('SRT thành VTT: dấu thập phân đổi thành chấm, số thứ tự block biến mất', () => {
  const srt = '1\r\n00:00:01,000 --> 00:00:03,500\r\nCâu một\r\n\r\n2\r\n00:01:00,250 --> 00:01:02,000\r\nCâu hai\r\n';
  const vtt = toVtt(srt, detectFormat(srt, 'phim.srt'));
  assert.equal(vtt.split('\n')[0], 'WEBVTT');
  assert.deepEqual(cueAt(vtt, 0), ['00:00:01.000 --> 00:00:03.500', 'Câu một']);
  assert.deepEqual(cueAt(vtt, 1), ['00:01:00.250 --> 00:01:02.000', 'Câu hai']);
  assert.equal(cueCount(vtt), 2);
  // CRLF phải rụng hết: `\r` sót lại trong dòng timing là cue bị bỏ.
  assert.ok(!vtt.includes('\r'));
});

test('dòng trắng giữa hai dòng thoại không cắt đứt cue', () => {
  const srt = '1\n00:00:01,000 --> 00:00:05,000\nDòng một\n\nDòng hai\n\n2\n00:00:06,000 --> 00:00:07,000\nX\n';
  const vtt = toVtt(srt, 'srt');
  assert.deepEqual(cueAt(vtt, 0), ['00:00:01.000 --> 00:00:05.000', 'Dòng một', 'Dòng hai']);
  assert.equal(cueCount(vtt), 2, 'cue sau vẫn phải còn');
});

test('thoại chỉ có một con số không bị nhận nhầm là số thứ tự', () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,000\nNăm\n1995\n\n2\n00:00:03,000 --> 00:00:04,000\nHết\n';
  assert.deepEqual(cueAt(toVtt(srt, 'srt'), 0), ['00:00:01.000 --> 00:00:02.000', 'Năm', '1995']);
});

test('thẻ: giữ <i>, bỏ <font>, escape < và & lẻ', () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,000\n<font color="#fff"><i>Nghiêng</i></font> khi a < b & c\n';
  assert.deepEqual(cueAt(toVtt(srt, 'srt'), 0), [
    '00:00:01.000 --> 00:00:02.000', '<i>Nghiêng</i> khi a &lt; b &amp; c'
  ]);
});

test('thẻ nghiêng bị escape hai lần được sửa ngay lúc chuyển', () => {
  // Đây chính là thứ vòng lặp `cleanCues` trong Watch.tsx phải đi vá mỗi giây cho sub
  // của nguồn; sub mình gắn thì sạch từ đây nên không cần vá.
  const srt = '1\n00:00:01,000 --> 00:00:02,000\n&lt;i&gt;Nghiêng&lt;/i&gt;\n';
  assert.deepEqual(cueAt(toVtt(srt, 'srt'), 0), ['00:00:01.000 --> 00:00:02.000', '<i>Nghiêng</i>']);
});

test('VTT giữ nguyên cài đặt vị trí sau -->, SRT thì không sinh ra', () => {
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:03.000 line:90% align:center\nChữ\n';
  assert.deepEqual(cueAt(toVtt(vtt, detectFormat(vtt, 'a.vtt')), 0), [
    '00:00:01.000 --> 00:00:03.000 line:90% align:center', 'Chữ'
  ]);
  assert.equal(cueAt(toVtt('1\n00:00:01,000 --> 00:00:03,000 x\nChữ\n', 'srt'), 0)[0], '00:00:01.000 --> 00:00:03.000');
});

test('ASS: đọc cột theo dòng Format, Text là cột cuối nên giữ được dấu phẩy', () => {
  const ass = [
    '[Script Info]', 'Title: x', '[V4+ Styles]', 'Format: Name, Fontname',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:10.50,0:00:12.00,Default,,0,0,0,,{\\an8}Câu sau, có phẩy',
    'Dialogue: 0,0:00:05.00,0:00:07.25,Default,,0,0,0,,Câu trước\\Nxuống dòng'
  ].join('\n');
  const vtt = toVtt(ass, detectFormat(ass, 'phim.txt'));
  // Dialogue trong file để lộn thứ tự — phải sắp lại, player bỏ qua cue lùi về trước.
  assert.deepEqual(cueAt(vtt, 0), ['00:00:05.000 --> 00:00:07.250', 'Câu trước', 'xuống dòng']);
  assert.deepEqual(cueAt(vtt, 1), ['00:00:10.500 --> 00:00:12.000', 'Câu sau, có phẩy']);
});

test('SSA cũ thiếu cột Layer vẫn ra đúng mốc thời gian', () => {
  const ssa = [
    '[Events]',
    'Format: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: Marked=0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Xin chào'
  ].join('\n');
  assert.deepEqual(cueAt(toVtt(ssa, 'ass'), 0), ['00:00:01.000 --> 00:00:02.000', 'Xin chào']);
});

test('mốc thời gian: hai số lẻ của ASS là centigiây, làm tròn 1000ms thì nhích giây', () => {
  assert.equal(parseStamp('0:01:02.50'), 62.5);
  assert.equal(parseStamp('01:02.500'), 62.5);
  assert.equal(parseStamp('00:01:02,5'), 62.5);
  assert.equal(parseStamp('không phải mốc'), null);
  assert.equal(formatStamp(1.9996), '00:00:02.000');
  assert.equal(formatStamp(3661.5), '01:01:01.500');
  assert.equal(formatStamp(-3), '00:00:00.000');
});

test('dịch thời gian: kẹp về 0, cue lùi hẳn ra trước phim thì bỏ', () => {
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nA\n\n00:00:10.000 --> 00:00:11.000\nB\n';
  assert.equal(cueCount(shiftVtt(vtt, -5)), 1, 'cue A nằm hẳn trước mốc 0 phải rụng');
  assert.deepEqual(cueAt(shiftVtt(vtt, -5), 0), ['00:00:05.000 --> 00:00:06.000', 'B']);
  // Chớm âm thì giữ, chỉ kẹp start — đúng cái người xem mong khi sub sớm vài giây.
  assert.deepEqual(cueAt(shiftVtt(vtt, -1.5), 0), ['00:00:00.000 --> 00:00:00.500', 'A']);
  assert.deepEqual(cueAt(shiftVtt(vtt, 2.25), 0), ['00:00:03.250 --> 00:00:04.250', 'A']);
  assert.equal(shiftVtt(vtt, 0), vtt, 'offset 0 không phải dựng lại file');
  // Dịch hai lần liên tiếp không được làm chữ bị escape thêm một lượt nữa.
  const escaped = toVtt('1\n00:00:05,000 --> 00:00:06,000\na < b & c\n', 'srt');
  assert.deepEqual(cueAt(shiftVtt(shiftVtt(escaped, 1), 1), 0), ['00:00:07.000 --> 00:00:08.000', 'a &lt; b &amp; c']);
});

test('bảng mã: BOM tin ngay, UTF-8 hợp lệ thắng, byte sai mới rơi xuống windows-1258', () => {
  assert.equal(decodeSubtitle(bytes('Xin chào')).encoding, 'utf-8');
  assert.equal(decodeSubtitle(bytes('Xin chào')).text, 'Xin chào');
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('WEBVTT')]);
  assert.deepEqual(decodeSubtitle(bom), { text: 'WEBVTT', encoding: 'utf-8' });
  const utf16 = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
  assert.deepEqual(decodeSubtitle(utf16), { text: 'AB', encoding: 'utf-16le' });
  // 0xEA là "ê" ở windows-1258 nhưng là byte mở đầu dở dang ở UTF-8 → UTF-8 phải đổ.
  const legacy = decodeSubtitle(new Uint8Array([0x54, 0x69, 0xea, 0x6e, 0x67]));
  assert.equal(legacy.encoding, 'windows-1258');
  assert.equal(legacy.text, 'Tiêng');
});

test('định dạng đọc từ nội dung, đuôi file chỉ là đường lùi', () => {
  assert.equal(detectFormat('WEBVTT\n\n00:01.000 --> 00:02.000\nx'), 'vtt');
  assert.equal(detectFormat('[Script Info]\n', 'sub.srt'), 'ass', 'trang chia sẻ hay đặt .srt cho file ASS');
  assert.equal(detectFormat('1\n00:00:01,000 --> 00:00:02,000\nx', 'sub.txt'), 'srt');
  assert.equal(detectFormat('nội dung không rõ', 'sub.ass'), 'ass');
  assert.equal(detectFormat('nội dung không rõ', 'sub.ssa'), 'ass');
  assert.equal(detectFormat('nội dung không rõ', 'sub.vtt'), 'vtt');
});

test('đoán ngôn ngữ: tiếng Việt thắng tiếng Anh, không khớp vào giữa chữ', () => {
  assert.deepEqual(guessTrackMeta('Movie.2019.EN-VI.srt'), { lang: 'vi', label: 'Tiếng Việt' });
  assert.equal(guessTrackMeta('Tiếng Việt.srt').lang, 'vi');
  assert.equal(guessTrackMeta('Show.S01E05.ENG.srt').lang, 'en');
  // "en" nằm trong Golden/Green, "th" trong The, "es" trong Yes — không được tính.
  for (const name of ['Golden.Compass.srt', 'The.Matrix.1999.srt', 'Yes.Man.srt', 'Death.Note.ass']) {
    assert.equal(guessTrackMeta(name).lang, '', name);
  }
  // Không đoán được thì nhãn là tên file đã dọn, để người xem còn phân biệt được.
  assert.equal(guessTrackMeta('Bản.dịch.của.nhóm.srt').label, 'Bản dịch của nhóm');
});

test('đoán số tập: nhãn rõ thì tin, số trần thì chỉ khi không còn gì khác', () => {
  assert.equal(episodeHint('Show.S01E05.1080p.srt'), 5);
  assert.equal(episodeHint('Phim.Ep.12.vietnamese.ass'), 12);
  assert.equal(episodeHint('tap-07.srt'), 7);
  assert.equal(episodeHint('[08] fansub.ass'), 8);
  assert.equal(episodeHint('My.Show.03.1080p.srt'), 3, 'bỏ rác kỹ thuật rồi còn đúng một số');
  assert.equal(episodeHint('A.2019.1080p.DDP5.1.x265-Group.srt'), null, 'năm và codec không phải số tập');
  assert.equal(episodeHint('Movie.2019.1080p.WEB-DL.x264.VI.srt'), null);
  assert.equal(episodeHint('phim.le.srt'), null);
});

test('prepareSubtitle gói đủ thứ UI cần từ byte thô', () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,000\nXin chào\n';
  assert.deepEqual(prepareSubtitle(bytes(srt), 'Show.S01E03.vi.srt'), {
    lang: 'vi', label: 'Tiếng Việt', format: 'srt', encoding: 'utf-8', cues: 1, episode: 3,
    vtt: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nXin chào\n'
  });
  // Đường đi của sub tải từ API: base64 → byte → đúng cùng một hàm ở trên.
  const b64 = Buffer.from(srt, 'utf8').toString('base64');
  assert.equal(prepareSubtitle(base64ToBytes(b64), 'a.srt').vtt, prepareSubtitle(bytes(srt), 'a.srt').vtt);
});

test('file rác không làm đổ, chỉ ra file không có cue', () => {
  const vtt = toVtt('đây không phải phụ đề, chỉ là văn bản', 'srt');
  assert.equal(vtt, 'WEBVTT\n');
  assert.equal(cueCount(vtt), 0);
  assert.equal(prepareSubtitle(new Uint8Array(), 'trong.srt').cues, 0);
});
