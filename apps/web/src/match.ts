/**
 * So khớp phim giữa các nguồn.
 *
 * Mỗi nguồn (vsmov/kkphim/nguonc) đặt slug theo hệ riêng, nên khi đổi nguồn hay
 * bồi tập từ nguồn khác chỉ có **tên + năm** trong tay để tìm lại đúng phim. File
 * này thuần, không import gì chạy được — để `sources.ts` và test dùng chung.
 */

/** Bỏ dấu, đ→d, thường hoá, gom khoảng trắng — so tên tiếng Việt không lệch vì dấu. */
export function fold(input: unknown): string {
  return String(input ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Gợi ý nhận dạng một phim, lấy từ thẻ phim/preview đang có trên màn hình. */
export interface TitleHint { name: string; originName?: string | null; year?: number | null; slug?: string }

/**
 * Hai phim có phải là một: khớp tên (hoặc tên gốc) sau khi bỏ dấu, và năm không
 * lệch quá 1 (nguồn hay lệch năm phát hành/sản xuất). Thiếu năm một bên thì bỏ qua
 * điều kiện năm thay vì loại oan.
 */
export function sameTitle(name: unknown, originName: unknown, wanted: TitleHint, year?: unknown): boolean {
  const have = new Set([fold(name), fold(originName)].filter(Boolean));
  const want = new Set([fold(wanted.name), fold(wanted.originName)].filter(Boolean));
  let hit = false;
  for (const value of have) if (want.has(value)) { hit = true; break; }
  if (!hit) return false;
  const a = Number(year), b = Number(wanted.year);
  if (Number.isFinite(a) && Number.isFinite(b) && a && b) return Math.abs(a - b) <= 1;
  return true;
}

/** Vài từ khoá để tìm phim ở nguồn khác: tên rồi tên gốc, bỏ trùng, bỏ rỗng. */
export function searchKeywords(wanted: TitleHint): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [wanted.name, wanted.originName]) {
    const text = String(raw ?? '').trim();
    const key = fold(text);
    if (text && key && !seen.has(key)) { seen.add(key); out.push(text); }
  }
  return out;
}
