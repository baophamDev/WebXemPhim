/**
 * Đổi mọi định dạng phụ đề hay gặp thành WebVTT — thứ duy nhất thẻ `<track>` đọc
 * được.
 *
 * Vì sao việc này nằm ở web chứ không ở API: file người dùng chọn nằm trong máy
 * họ, không có lý gì đẩy lên mạng rồi tải về. Và khi đã có bộ chuyển đổi ở đây thì
 * sub tải từ OpenSubtitles/SubDL cũng đi đúng một đường đó — API chỉ tìm, tải,
 * giải nén rồi trả **byte thô** (xem `services/api/src/subtitles.ts`). Một đường
 * chuyển đổi duy nhất nghĩa là sub tự tìm không thể lệch hành vi so với sub tự
 * chọn: cùng bộ dò bảng mã, cùng bộ dọn thẻ, cùng cách dịch thời gian.
 *
 * File thuần chuỗi vào / chuỗi ra, không DOM, không fetch — `test/subs.test.mjs`
 * gọi trực tiếp bằng dữ liệu tự dựng.
 */

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

/** Thẻ WebVTT hiểu được. Còn lại (`<font color>`, `<p>`...) bị bỏ, xem `cleanText`. */
const KEEP_TAGS = new Set(['i', 'b', 'u', 'ruby', 'rt', 'v', 'lang', 'c']);

/**
 * Thứ tự dò bảng mã. UTF-8 xét trước với `fatal: true` để byte sai làm nó đổ; các
 * bảng một byte thì không bao giờ đổ nên phải nằm sau, không thì mọi file đều
 * "hợp lệ" ngay ở bảng đầu tiên.
 *
 * windows-1258 trước 1252 vì đó là bảng mã Việt: sub cũ tải từ các trang chia sẻ
 * hay ở dạng này, và đọc bằng 1252 thì ra chữ có dấu sai.
 */
const FALLBACK_ENCODINGS = ['windows-1258', 'windows-1252'];

export interface DecodedSubtitle {
  text: string;
  /** Bảng mã đã dùng — hiện lên UI để người xem biết vì sao chữ bị lỗi. */
  encoding: string;
}

/**
 * Byte → chuỗi. BOM là bằng chứng chắc chắn nên xét trước mọi phép đoán.
 *
 * Không có thư viện dò bảng mã nào ở đây là cố ý: `TextDecoder` có sẵn trong trình
 * duyệt, và phép thử "UTF-8 nghiêm ngặt trước, bảng một byte sau" bắt đúng cái
 * nhầm duy nhất hay xảy ra với sub tiếng Việt.
 */
export function decodeSubtitle(input: ArrayBuffer | Uint8Array): DecodedSubtitle {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  for (const encoding of ['utf-8', ...FALLBACK_ENCODINGS]) {
    try {
      return { text: new TextDecoder(encoding, { fatal: true }).decode(bytes), encoding };
    } catch { /* bảng mã này không đọc nổi, thử bảng sau */ }
  }
  // Không bảng nào sạch: đọc lỏng bằng UTF-8, chữ lỗi vẫn hơn không có gì.
  return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8 (có ký tự lỗi)' };
}

/**
 * Định dạng đọc từ **nội dung** trước, đuôi file chỉ là đường lùi: sub tải về hay
 * mang tên `.txt`, và trang chia sẻ thì đặt `.srt` cho cả file ASS.
 */
export function detectFormat(text: string, filename = ''): SubtitleFormat {
  const head = text.slice(0, 4_000);
  if (/^\uFEFF?WEBVTT/.test(head)) return 'vtt';
  if (/\[Script Info\]|\[V4\+? Styles\]|^Dialogue:/im.test(head)) return 'ass';
  if (/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(head)) return 'srt';
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extension === 'vtt') return 'vtt';
  if (extension === 'ass' || extension === 'ssa') return 'ass';
  return 'srt';
}

const pad = (value: number, width = 2) => String(Math.floor(value)).padStart(width, '0');

/** Giây → `hh:mm:ss.mmm`. WebVTT bắt buộc dấu chấm và đúng 3 số lẻ. */
export function formatStamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const whole = Math.floor(clamped);
  const millis = Math.round((clamped - whole) * 1000);
  // Làm tròn lên đúng 1000ms thì phải nhích giây, không thì ra "00:00:01.1000".
  const carry = millis === 1000 ? 1 : 0;
  return `${pad(Math.floor((whole + carry) / 3600))}:${pad(Math.floor(((whole + carry) % 3600) / 60))}:${pad((whole + carry) % 60)}.${pad(carry ? 0 : millis, 3)}`;
}

/**
 * Đọc mốc thời gian của cả ba định dạng: `00:01:02,500` (SRT), `00:01:02.500`
 * (VTT), `0:01:02.50` (ASS — hai số lẻ là **centigiây**), và dạng thiếu giờ
 * `01:02.500` mà VTT cho phép.
 */
export function parseStamp(raw: string): number | null {
  const match = raw.trim().match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[,.](\d{1,3}))?$/);
  if (!match) return null;
  const [, hours, minutes, seconds, fraction] = match;
  // ".5" là 500ms, ".50" là 500ms, ".500" là 500ms — chuẩn hoá về 3 chữ số.
  const millis = fraction ? Number(fraction.padEnd(3, '0')) : 0;
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds) + millis / 1000;
}

/** Chữ thường: `&` lẻ và `<`/`>` phải escape, không thì VTT hiểu thành thẻ. */
const escapeText = (text: string) => text
  .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,7}|#\d{1,6}|#x[0-9a-fA-F]{1,5});)/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\.[^\s>]+)?)[^>]*>/g;

/**
 * Dọn phần chữ của một cue.
 *
 * WebVTT coi `<...>` là thẻ, nên bỏ nguyên văn chữ của SRT vào là mất chữ: một câu
 * `<font color="#fff">` biến thành khoảng trắng, còn `a < b` thì ăn luôn phần sau.
 * Nên: đi qua chuỗi một lượt, phần ngoài thẻ thì escape, phần là thẻ thì giữ nếu
 * WebVTT hiểu được và bỏ nếu không.
 *
 * Hai thứ được dọn thêm vì gặp thường xuyên hơn cả `<font>`:
 * - `{\an8}`, `{\i1}` — tag của ASS nhưng lọt cả vào file SRT do máy chuyển đổi tự
 *   động, để nguyên thì hiện lên giữa câu thoại.
 * - `&lt;i&gt;` — thẻ nghiêng bị escape hai lần, cũng do máy chuyển đổi. Đây chính
 *   là thứ vòng lặp dọn cue trong `Watch.tsx` phải đi vá ở phía sau; sửa từ đây
 *   thì sub mình gắn không bao giờ mắc lỗi đó.
 */
function cleanText(raw: string): string {
  const stripped = raw
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/&lt;(\/?)(i|b|u)&gt;/gi, '<$1$2>');
  let out = '';
  let cursor = 0;
  TAG.lastIndex = 0;
  for (let match = TAG.exec(stripped); match; match = TAG.exec(stripped)) {
    out += escapeText(stripped.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const name = match[1].toLowerCase();
    if (KEEP_TAGS.has(name)) out += match[0].startsWith('</') ? `</${name}>` : `<${name}${match[2]}>`;
  }
  // Dòng trắng **kết thúc** một cue trong WebVTT, nên chữ sau nó sẽ biến mất. File
  // thật hay có dòng trắng giữa hai dòng thoại (xem `blocksToVtt`), gộp lại thành một.
  return (out + escapeText(stripped.slice(cursor))).replace(/\n[ \t]*(?:\n[ \t]*)+/g, '\n').trim();
}

interface Cue {
  start: number;
  end: number;
  text: string;
  /** Phần cài đặt vị trí phía sau `-->` của VTT, giữ nguyên khi đọc lại file VTT. */
  settings?: string;
}

/**
 * Cue → text WebVTT. Bỏ cue rỗng và cue có thời lượng âm: player bỏ qua chúng thầm lặng.
 *
 * Kẹp về 0 **trước** khi so start/end, không phải trong `formatStamp`: cue bị `shiftVtt`
 * đẩy hẳn về trước mốc 0 (start −4, end −3) vẫn "hợp lệ" nếu chỉ so hai số gốc, và sẽ
 * in ra thành `00:00:00.000 --> 00:00:00.000` — một cue rỗng nằm ngay đầu phim.
 */
function buildVtt(cues: Cue[]): string {
  const lines = ['WEBVTT', ''];
  for (const cue of cues) {
    const start = Math.max(0, cue.start);
    const end = Math.max(0, cue.end);
    if (!cue.text || end <= start) continue;
    lines.push(`${formatStamp(start)} --> ${formatStamp(end)}${cue.settings ? ` ${cue.settings}` : ''}`);
    lines.push(cue.text, '');
  }
  return lines.join('\n');
}

const TIMING = /^(.+?)\s*-->\s*([^\s]+)(?:\s+(.*))?$/;

/**
 * SRT (và VTT — cùng cấu trúc block, khác dấu thập phân và có thêm dòng `WEBVTT`).
 *
 * Không tách block bằng dòng trắng: file thật hay có dòng trắng **giữa** hai dòng
 * thoại của cùng một cue, tách kiểu đó là mất nửa câu. Thay vào đó quét theo dòng
 * và mỗi lần thấy `-->` là bắt đầu cue mới — dấu hiệu này không bao giờ nhầm.
 * Cách này cũng bỏ luôn dòng số thứ tự mà không cần biết nó có tồn tại hay không.
 */
function blocksToVtt(text: string, keepSettings: boolean): string {
  const cues: Cue[] = [];
  let current: Cue | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '');
    const timing = line.includes('-->') ? TIMING.exec(line.trim()) : null;
    if (timing) {
      const start = parseStamp(timing[1]);
      const end = parseStamp(timing[2]);
      if (start !== null && end !== null) {
        current = { start, end, text: '', settings: keepSettings ? timing[3]?.trim() || undefined : undefined };
        cues.push(current);
        continue;
      }
    }
    if (!current) continue; // header WEBVTT, khối STYLE/NOTE, số thứ tự lẻ trước cue đầu
    // Dòng chỉ có số ngay trước một dòng timing là số thứ tự của cue kế tiếp, không
    // phải thoại — nhưng ở đây chưa biết dòng sau là gì, nên gom rồi dọn ở dưới.
    current.text += current.text ? `\n${line}` : line;
  }
  // Số thứ tự của cue **kế tiếp** đã bị gom vào cuối cue này (lúc quét chưa biết dòng
  // sau là timing). Chỉ cắt khi nó đứng sau một dòng trắng — tức đúng chỗ SRT ngắt
  // block — để câu thoại chỉ có một con số ("Năm 1995") không bị mất.
  for (const cue of cues) cue.text = cleanText(cue.text.trimEnd().replace(/\n[ \t]*\n[ \t]*\d{1,5}$/, ''));
  return buildVtt(cues);
}

/**
 * ASS/SSA — định dạng của phần lớn sub fansub phim cổ trang Trung/Hàn.
 *
 * Thứ tự cột đọc từ dòng `Format:` chứ không đoán: bản SSA cũ thiếu cột `Layer`, và
 * `Text` luôn là cột cuối nên phần còn lại của dòng (kể cả dấu phẩy trong thoại)
 * thuộc về nó. Dialogue trong file không bảo đảm đúng thứ tự thời gian nên phải sắp
 * lại — player bỏ qua cue lùi về trước.
 *
 * Toàn bộ phần tạo dáng (màu, font, vị trí, karaoke) bị bỏ: WebVTT không có chỗ cho
 * chúng, và giữ lại thì thành chữ rác giữa câu thoại.
 */
function assToVtt(text: string): string {
  const lines = text.split(/\r?\n/);
  let fields: string[] = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
  const cues: Cue[] = [];
  let inEvents = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\[.*\]$/.test(line)) { inEvents = /^\[events\]$/i.test(line); continue; }
    if (!inEvents) continue;
    if (/^Format\s*:/i.test(line)) {
      fields = line.slice(line.indexOf(':') + 1).split(',').map((field) => field.trim().toLowerCase());
      continue;
    }
    if (!/^Dialogue\s*:/i.test(line)) continue;
    const parts = line.slice(line.indexOf(':') + 1).split(',');
    const textIndex = fields.indexOf('text');
    const at = (name: string) => { const index = fields.indexOf(name); return index < 0 ? '' : (parts[index] ?? '').trim(); };
    const start = parseStamp(at('start'));
    const end = parseStamp(at('end'));
    if (start === null || end === null) continue;
    const body = (textIndex < 0 ? parts.slice(-1) : parts.slice(textIndex)).join(',');
    cues.push({ start, end, text: cleanText(body.replace(/\\N|\\n/g, '\n').replace(/\\h/g, ' ')) });
  }
  cues.sort((left, right) => left.start - right.start || left.end - right.end);
  return buildVtt(cues);
}

/** Điểm vào duy nhất: byte hoặc chuỗi bất kỳ → WebVTT. */
export function toVtt(text: string, format: SubtitleFormat): string {
  if (format === 'ass') return assToVtt(text);
  return blocksToVtt(text, format === 'vtt');
}

/**
 * Dịch toàn bộ mốc thời gian đi `seconds` giây — nút "sub sớm/muộn" của người xem.
 *
 * Nhận và trả WebVTT (không phải định dạng gốc) vì lúc này file đã chuyển xong và
 * lưu trong IndexedDB ở dạng VTT; người xem kéo offset liên tục nên phải rẻ. Không
 * gọi `cleanText` lại: chữ đã sạch từ lần chuyển đầu, dọn nữa chỉ tốn công.
 *
 * Cue bị đẩy về trước mốc 0 thì `buildVtt` tự bỏ (start và end cùng bị kẹp về 0 nên
 * `end <= start`), còn cue chỉ *chớm* âm thì giữ lại với start = 0 — đúng hành vi
 * người xem mong đợi khi sub sớm hơn phim vài giây.
 */
export function shiftVtt(vtt: string, seconds: number): string {
  if (!seconds) return vtt;
  const cues: Cue[] = [];
  let current: Cue | null = null;
  for (const raw of vtt.split(/\r?\n/)) {
    const timing = raw.includes('-->') ? TIMING.exec(raw.trim()) : null;
    const start = timing ? parseStamp(timing[1]) : null;
    const end = timing ? parseStamp(timing[2]) : null;
    if (timing && start !== null && end !== null) {
      current = { start: start + seconds, end: end + seconds, text: '', settings: timing[3]?.trim() || undefined };
      cues.push(current);
      continue;
    }
    if (!current || !raw.trim()) continue;
    current.text += current.text ? `\n${raw}` : raw;
  }
  return buildVtt(cues);
}

/** Đếm cue — hiện lên UI để biết file có thật sự đọc được hay chỉ ra một khung rỗng. */
export function cueCount(vtt: string): number {
  let count = 0;
  for (const line of vtt.split('\n')) if (line.includes('-->')) count += 1;
  return count;
}

/**
 * base64 → byte. API trả sub ở dạng base64 (xem `services/api/src/subtitles.ts`) chứ
 * không trả chuỗi đã giải mã, để việc dò bảng mã chỉ xảy ra đúng một lần ở đây.
 */
export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Đoán ngôn ngữ từ tên file.
 *
 * `srclang` của `<track>` cần mã BCP-47 để trình duyệt hiện đúng tên trong menu phụ
 * đề gốc (Safari/webOS dùng menu hệ thống, không dùng menu của web), còn `label` là
 * chữ người xem đọc nên viết tiếng Việt.
 *
 * Tiếng Việt xét trước tiếng Anh vì tên file hay có cả hai (`Movie.2019.EN-VI.srt`),
 * và ở đây người xem cần bản Việt. Ranh giới `[^a-z]` là để `en` không khớp vào giữa
 * chữ ("Tieng", "Golden"); dấu bị bỏ trước khi so để "Tiếng Việt.srt" cũng khớp.
 */
const LANGUAGES: Array<{ code: string; label: string; match: RegExp }> = [
  { code: 'vi', label: 'Tiếng Việt', match: /(?:^|[^a-z])(?:vi|vie|vn|viet|vietnamese|tieng[\W_]?viet)(?:[^a-z]|$)/i },
  { code: 'en', label: 'Tiếng Anh', match: /(?:^|[^a-z])(?:en|eng|english)(?:[^a-z]|$)/i },
  { code: 'zh', label: 'Tiếng Trung', match: /(?:^|[^a-z])(?:zh|chi|chs|cht|zho|chinese)(?:[^a-z]|$)/i },
  { code: 'ko', label: 'Tiếng Hàn', match: /(?:^|[^a-z])(?:ko|kor|korean)(?:[^a-z]|$)/i },
  { code: 'ja', label: 'Tiếng Nhật', match: /(?:^|[^a-z])(?:ja|jp|jpn|japanese)(?:[^a-z]|$)/i },
  { code: 'th', label: 'Tiếng Thái', match: /(?:^|[^a-z])(?:th|tha|thai)(?:[^a-z]|$)/i },
  { code: 'fr', label: 'Tiếng Pháp', match: /(?:^|[^a-z])(?:fr|fre|fra|french)(?:[^a-z]|$)/i },
  { code: 'es', label: 'Tiếng Tây Ban Nha', match: /(?:^|[^a-z])(?:es|spa|spanish)(?:[^a-z]|$)/i }
];

const unaccent = (value: string) => value.normalize('NFD').replace(/\p{M}+/gu, '').replace(/đ/gi, 'd');

/** Tên file → nhãn đọc được: bỏ đuôi, bỏ dấu phân cách, cắt cho vừa menu. */
function tidyName(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return 'Phụ đề';
  return base.length > 42 ? `${base.slice(0, 41)}…` : base;
}

export interface TrackMeta {
  /** Mã BCP-47, chuỗi rỗng nếu không đoán được — `<track>` bỏ trống `srclang`. */
  lang: string;
  label: string;
}

export function guessTrackMeta(filename: string): TrackMeta {
  const probe = unaccent(filename);
  const hit = LANGUAGES.find((entry) => entry.match.test(probe));
  return { lang: hit?.code ?? '', label: hit?.label ?? tidyName(filename) };
}

/**
 * Rác kỹ thuật trong tên file phát hành — phải bỏ **trước** khi đi tìm số tập, không
 * thì `1080p`, `x264`, `DDP5.1`, năm `2019` đều trông như số tập.
 */
const RELEASE_NOISE = /\b(?:\d{3,4}p|[xh]\.?26[45]|hevc|avc|10bit|8bit|aac\d?|ac3|e?ac3|ddp?\d(?:\.\d)?|dts(?:-hd)?|truehd|atmos|web-?dl|web-?rip|blu-?ray|br-?rip|hd-?tv|hdr\d*|dv|remux|repack|proper|amzn|nf|dsnp|max|imax|\d{4}|s\d{1,2}|part\d|cd\d|v\d)\b/gi;

/**
 * Số tập đoán từ tên file. `null` khi không chắc — thà để người xem tự chọn còn hơn
 * gắn sub tập 3 vào tập 30.
 *
 * Dùng khi người xem chọn **nhiều file một lúc** cho phim bộ: mỗi file về đúng tập
 * của nó, không phải mở từng tập rồi gắn từng cái.
 *
 * Thứ tự dò là thứ tự độ tin cậy: `S01E05` gần như không thể sai, `Ep05` cũng vậy,
 * `[05]` thì thường đúng, còn số trần chỉ xét sau khi đã bỏ hết rác kỹ thuật và chỉ
 * nhận khi còn lại **đúng một** số — hai số trở lên là không đủ căn cứ.
 */
export function episodeHint(filename: string): number | null {
  const name = unaccent(filename.replace(/\.[a-z0-9]{1,5}$/i, ''));
  const labelled = /s\d{1,2}[\s._-]*e(\d{1,3})\b/i.exec(name)
    ?? /(?:^|[^a-z0-9])(?:ep?|tap|episode|hoi)[\s._-]*(\d{1,3})(?![0-9])/i.exec(name)
    ?? /[[(](\d{1,3})[\])]/.exec(name);
  if (labelled) return Number(labelled[1]);
  const bare = name.replace(RELEASE_NOISE, ' ').match(/(?:^|[\s._-])(\d{1,3})(?=[\s._-]|$)/g);
  if (bare?.length !== 1) return null;
  return Number(bare[0].replace(/\D/g, ''));
}

export interface PreparedSubtitle extends TrackMeta {
  /** WebVTT đã sạch, sẵn sàng thành Blob cho `<track>`. */
  vtt: string;
  format: SubtitleFormat;
  encoding: string;
  cues: number;
  /** Số tập đoán từ tên file, `null` nếu không chắc. */
  episode: number | null;
}

/**
 * Byte + tên file → mọi thứ UI cần. Đây là điểm vào duy nhất: file người xem chọn và
 * file API tải về đều đi qua đây, nên hai đường không thể lệch nhau.
 */
export function prepareSubtitle(input: ArrayBuffer | Uint8Array, filename = ''): PreparedSubtitle {
  const { text, encoding } = decodeSubtitle(input);
  const format = detectFormat(text, filename);
  const vtt = toVtt(text, format);
  return { ...guessTrackMeta(filename), vtt, format, encoding, cues: cueCount(vtt), episode: episodeHint(filename) };
}
