/**
 * Bóc quảng cáo khỏi playlist HLS (.m3u8).
 *
 * Nguồn phim nhồi quảng cáo thẳng vào playlist: vài chục giây segment .ts ở đầu
 * file (và đôi khi thêm một block giữa phim), ngăn nhau bằng
 * #EXT-X-DISCONTINUITY. Player không có cách nào biết đâu là phim đâu là quảng
 * cáo — nó chỉ phát tuần tự những gì playlist liệt kê. Nên chỗ rẻ nhất để xử lý
 * là sửa playlist trước khi giao cho player, thay vì bắt người xem chờ.
 *
 * Ba dấu hiệu, mạnh trước yếu sau:
 *   1. #EXT-X-CUE-OUT / #EXT-X-CUE-IN (SCTE-35) — nguồn tự khai đây là ad break.
 *   2. Đường dẫn segment chứa từ khoá quảng cáo.
 *   3. Segment nằm khác host hoặc khác thư mục so với block dài nhất playlist —
 *      quảng cáo gần như luôn được chèn từ một CDN khác.
 *
 * Quy tắc 3 chỉ bật khi block dài nhất chiếm quá nửa tổng thời lượng, và không
 * bao giờ xoá hết: playlist có cấu trúc lạ thì thà để nguyên còn hơn trả về file
 * rỗng làm chết luôn tập phim.
 *
 * File này thuần chuỗi vào / chuỗi ra, không I/O — để test được bằng playlist tự
 * dựng và dùng chung cho cả master lẫn media playlist.
 */

/** Tag phải bám theo segment ngay sau nó, không phải tag của header. */
const SEGMENT_TAGS = ['#EXTINF', '#EXT-X-BYTERANGE', '#EXT-X-PROGRAM-DATE-TIME', '#EXT-X-BITRATE', '#EXT-X-GAP'];

/** Tag chỉ mô tả ad break — bỏ luôn khỏi playlist trả về. */
const AD_MARKER_TAGS = ['#EXT-X-CUE-OUT', '#EXT-X-CUE-IN', '#EXT-OATCLS-SCTE35', '#EXT-X-SCTE35', '#EXT-X-ASSET', '#EXT-X-DATERANGE'];

/**
 * Dấu hiệu quảng cáo đọc được ngay trên đường dẫn segment. Cố tình neo vào dấu
 * phân cách (`/ads/`, `-ad_`) để không quét trúng những từ vô can như
 * "adaptive" hay "download".
 */
const AD_URL_PATTERNS: RegExp[] = [
  /\/ads?[-_/]/i,
  /[-_]ads?[-_.\d]/i,
  /advert/i,
  /quang[-_]?cao/i,
  /(pre|mid|post)[-_]?roll/i,
  /\/(bumper|sponsor|promo)[-_/.]/i,
  /doubleclick|googleads|googlesyndication|pubads|adservice|adsystem|adnxs|imasdk|zedo/i
];

export interface AdFilterReport {
  kind: 'master' | 'media';
  /** VOD (có #EXT-X-ENDLIST) thì cache được lâu, live thì không. */
  vod: boolean;
  segments: { total: number; kept: number; removed: number };
  /** Giây. */
  duration: { total: number; kept: number; removed: number };
  groups: { index: number; signature: string; segments: number; duration: number; verdict: string; firstUri: string }[];
}

export interface FilteredPlaylist {
  playlist: string;
  report: AdFilterReport;
}

interface Segment {
  uri: string;
  duration: number;
  /** EXTINF, BYTERANGE... giữ nguyên thứ tự để dựng lại y như cũ. */
  tags: string[];
  key: string | null;
  map: string | null;
  discontinuity: boolean;
  inCueOut: boolean;
}

interface Group {
  index: number;
  segments: Segment[];
  duration: number;
  signature: string;
  /** null = giữ lại; khác null = lý do bị coi là quảng cáo. */
  reason: string | null;
}

interface ParsedMedia {
  header: string[];
  segments: Segment[];
  targetDuration: number;
  mediaSequence: number;
  endList: boolean;
}

const round = (value: number) => Math.round(value * 10) / 10;

function absolute(uri: string, base: string) {
  try { return new URL(uri.trim(), base).toString(); } catch { return uri.trim(); }
}

/** Đổi thuộc tính URI="..." trong tag (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA...). */
function rewriteUriAttribute(line: string, transform: (uri: string) => string) {
  return line.replace(/URI="([^"]*)"/i, (_match, uri: string) => `URI="${transform(uri)}"`);
}

/** Host + thư mục chứa segment: quảng cáo và phim gần như luôn khác nhau ở đây. */
function signatureOf(uri: string) {
  try {
    const url = new URL(uri);
    return `${url.host}${url.pathname.replace(/[^/]*$/, '')}`;
  } catch {
    return uri.replace(/[^/]*$/, '');
  }
}

const looksLikeAd = (uri: string) => AD_URL_PATTERNS.some((pattern) => pattern.test(uri));

const emptyReport = (kind: AdFilterReport['kind'], vod = false): AdFilterReport => ({
  kind, vod, segments: { total: 0, kept: 0, removed: 0 }, duration: { total: 0, kept: 0, removed: 0 }, groups: []
});

export function isMasterPlaylist(text: string) {
  return /^#EXT-X-STREAM-INF/im.test(text) && !/^#EXTINF/im.test(text);
}

/**
 * Master playlist chỉ trỏ sang các playlist con, quảng cáo nằm trong con — nên
 * URI con phải đi tiếp qua proxy, còn key thì trỏ thẳng CDN (tiết kiệm một chặng).
 */
export function rewriteMaster(text: string, base: string, proxy: (url: string) => string): FilteredPlaylist {
  const lines = text.split(/\r?\n/).map((raw) => {
    const line = raw.trim();
    if (!line) return null;
    if (!line.startsWith('#')) return proxy(absolute(line, base));
    if (/^#EXT-X-(MEDIA|I-FRAME-STREAM-INF)/i.test(line)) return rewriteUriAttribute(line, (uri) => proxy(absolute(uri, base)));
    if (/^#EXT-X-SESSION-KEY/i.test(line)) return rewriteUriAttribute(line, (uri) => absolute(uri, base));
    return line;
  });
  return { playlist: `${lines.filter((line): line is string => line !== null).join('\n')}\n`, report: emptyReport('master') };
}

function parseMedia(text: string, base: string): ParsedMedia {
  const header: string[] = [];
  const segments: Segment[] = [];
  let tags: string[] = [];
  let key: string | null = null;
  let map: string | null = null;
  let discontinuity = false;
  let inCueOut = false;
  let duration = 0;
  let targetDuration = 0;
  let mediaSequence = 0;
  let endList = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.startsWith('#')) {
      segments.push({ uri: absolute(line, base), duration, tags, key, map, discontinuity, inCueOut });
      tags = []; duration = 0; discontinuity = false;
      continue;
    }
    const upper = line.toUpperCase();
    if (upper === '#EXTM3U') continue;
    if (upper.startsWith('#EXT-X-TARGETDURATION')) { targetDuration = Number(line.split(':')[1]) || 0; continue; }
    if (upper.startsWith('#EXT-X-MEDIA-SEQUENCE')) { mediaSequence = Number(line.split(':')[1]) || 0; continue; }
    if (upper === '#EXT-X-ENDLIST') { endList = true; continue; }
    if (upper === '#EXT-X-DISCONTINUITY') { discontinuity = true; continue; }
    if (upper.startsWith('#EXT-X-KEY')) { key = rewriteUriAttribute(line, (uri) => absolute(uri, base)); continue; }
    if (upper.startsWith('#EXT-X-MAP')) { map = rewriteUriAttribute(line, (uri) => absolute(uri, base)); continue; }
    // CUE-IN xét trước CUE-OUT vì có cả biến thể #EXT-X-CUE-OUT-CONT.
    if (upper.startsWith('#EXT-X-CUE-IN')) { inCueOut = false; continue; }
    if (upper.startsWith('#EXT-X-CUE-OUT')) { inCueOut = true; continue; }
    if (AD_MARKER_TAGS.some((tag) => upper.startsWith(tag))) {
      if (/SCTE35-OUT/i.test(line)) inCueOut = true;
      if (/SCTE35-IN/i.test(line)) inCueOut = false;
      continue;
    }
    if (upper.startsWith('#EXTINF')) { duration = Number.parseFloat(line.slice(line.indexOf(':') + 1)) || 0; tags.push(line); continue; }
    if (SEGMENT_TAGS.some((tag) => upper.startsWith(tag))) { tags.push(line); continue; }
    // Tag lạ: trước segment đầu tiên coi là header, sau đó gắn theo segment.
    if (segments.length || tags.length) tags.push(line); else header.push(line);
  }
  return { header, segments, targetDuration, mediaSequence, endList };
}

/**
 * Cắt playlist thành block. Ngoài #EXT-X-DISCONTINUITY, cắt thêm mỗi khi
 * host/thư mục đổi — có nguồn chèn quảng cáo mà quên đặt dấu ngắt, không cắt
 * theo chữ ký thì cả phim và quảng cáo nằm chung một block, không lọc được gì.
 */
function groupSegments(segments: Segment[]): Group[] {
  const groups: Group[] = [];
  for (const segment of segments) {
    const signature = signatureOf(segment.uri);
    const last = groups[groups.length - 1];
    const sameRun = last && !segment.discontinuity && last.signature === signature
      && last.segments[last.segments.length - 1].inCueOut === segment.inCueOut;
    if (sameRun) { last.segments.push(segment); last.duration += segment.duration; continue; }
    groups.push({ index: groups.length, segments: [segment], duration: segment.duration, signature, reason: null });
  }
  return groups;
}

function judge(groups: Group[]) {
  const total = groups.reduce((sum, group) => sum + group.duration, 0);
  // Gộp thời lượng theo chữ ký, không theo block: quảng cáo chèn giữa phim làm
  // phần phim bị chẻ thành hai block, xét từng block thì không block nào chiếm
  // quá nửa và quy tắc chữ ký bị tắt oan.
  const bySignature = new Map<string, number>();
  for (const group of groups) bySignature.set(group.signature, (bySignature.get(group.signature) ?? 0) + group.duration);
  let mainSignature = groups[0].signature;
  let mainDuration = 0;
  for (const [signature, duration] of bySignature) if (duration > mainDuration) { mainSignature = signature; mainDuration = duration; }
  // Chữ ký chỉ đáng tin khi một nguồn áp đảo về thời lượng; playlist chia đều cho
  // nhiều thư mục thì đoán theo chữ ký dễ cắt trúng phim.
  const signatureRuleUsable = bySignature.size > 1 && total > 0 && mainDuration / total >= 0.5;
  for (const group of groups) {
    if (group.segments[0].inCueOut) { group.reason = 'ad break (CUE-OUT)'; continue; }
    if (group.segments.some((segment) => looksLikeAd(segment.uri))) { group.reason = 'từ khoá quảng cáo trong URL'; continue; }
    if (signatureRuleUsable && group.signature !== mainSignature) { group.reason = 'khác nguồn với phần phim'; }
  }
  // Không bao giờ trả playlist rỗng: mọi block đều bị chấm thì giữ block dài nhất.
  if (groups.every((group) => group.reason)) {
    groups.reduce((best, group) => (group.duration > best.duration ? group : best), groups[0]).reason = null;
  }
  return groups;
}

function buildMedia(parsed: ParsedMedia, groups: Group[]): FilteredPlaylist {
  const kept = groups.filter((group) => !group.reason);
  const keptSegments = kept.flatMap((group) => group.segments);
  const longest = keptSegments.reduce((max, segment) => Math.max(max, segment.duration), 0);
  // Bỏ segment ở đầu thì media sequence phải nhích theo, nếu không player sẽ
  // hiểu sai vị trí mỗi lần playlist làm mới (chỉ ảnh hưởng stream trực tiếp).
  const droppedBefore = kept.length
    ? groups.filter((group) => group.reason && group.index < kept[0].index).reduce((sum, group) => sum + group.segments.length, 0)
    : 0;

  const lines = ['#EXTM3U', ...parsed.header];
  lines.push(`#EXT-X-TARGETDURATION:${Math.max(1, Math.ceil(longest || parsed.targetDuration))}`);
  lines.push(`#EXT-X-MEDIA-SEQUENCE:${parsed.mediaSequence + droppedBefore}`);

  let key: string | null = null;
  let map: string | null = null;
  let previous: Group | null = null;
  for (const group of kept) {
    // Chỉ giữ dấu ngắt khi hai block vẫn kề nhau như trong playlist gốc. Cắt một
    // block quảng cáo ở giữa thì hai nửa phim là cùng một mạch thời gian —
    // thêm DISCONTINUITY vào chỉ làm player reset timeline và giật một nhịp.
    if (previous && group.segments[0].discontinuity && group.index === previous.index + 1) lines.push('#EXT-X-DISCONTINUITY');
    for (const segment of group.segments) {
      if (segment.map && segment.map !== map) { lines.push(segment.map); map = segment.map; }
      // Quảng cáo hay dùng key riêng; bỏ segment mà bỏ luôn tag key thì phần phim
      // sau đó sẽ giải mã bằng key sai, nên phát lại tag mỗi lần key đổi.
      if (segment.key !== key) { lines.push(segment.key ?? '#EXT-X-KEY:METHOD=NONE'); key = segment.key; }
      lines.push(...segment.tags, segment.uri);
    }
    previous = group;
  }
  if (parsed.endList) lines.push('#EXT-X-ENDLIST');

  const totalDuration = groups.reduce((sum, group) => sum + group.duration, 0);
  const keptDuration = kept.reduce((sum, group) => sum + group.duration, 0);
  return {
    playlist: `${lines.join('\n')}\n`,
    report: {
      kind: 'media',
      vod: parsed.endList,
      segments: { total: parsed.segments.length, kept: keptSegments.length, removed: parsed.segments.length - keptSegments.length },
      duration: { total: round(totalDuration), kept: round(keptDuration), removed: round(totalDuration - keptDuration) },
      groups: groups.map((group) => ({
        index: group.index, signature: group.signature, segments: group.segments.length,
        duration: round(group.duration), verdict: group.reason ?? 'giữ', firstUri: group.segments[0].uri
      }))
    }
  };
}

/**
 * Điểm vào duy nhất. `base` là URL thật của playlist (sau redirect) để mọi đường
 * dẫn tương đối trong file được đổi thành URL tuyệt đối — nhờ vậy segment vẫn tải
 * trực tiếp từ CDN, chỉ playlist đi qua máy chủ của mình.
 */
export function filterPlaylist(text: string, base: string, proxy: (url: string) => string): FilteredPlaylist {
  if (isMasterPlaylist(text)) return rewriteMaster(text, base, proxy);
  const parsed = parseMedia(text, base);
  if (!parsed.segments.length) return { playlist: text, report: emptyReport('media', /#EXT-X-ENDLIST/i.test(text)) };
  return buildMedia(parsed, judge(groupSegments(parsed.segments)));
}
