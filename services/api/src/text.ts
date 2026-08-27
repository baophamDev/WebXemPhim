/**
 * Chuẩn hoá text tiếng Việt để tìm kiếm và tạo slug.
 *
 * Không dùng extension `unaccent` của Postgres: trên Supabase extension nằm ở
 * schema `extensions` nên `unaccent()` khó index (không IMMUTABLE) và dễ vỡ khi
 * search_path khác nhau. Thay vào đó bỏ dấu ngay ở Node rồi lưu sẵn vào cột
 * `search_text` / `name_folded`, index bằng pg_trgm hoặc ILIKE thuần.
 */

/** "Người Nhện Đỏ" -> "nguoi nhen do". Dùng để so khớp và dedupe. */
export function fold(input: unknown): string {
  return String(input ?? '')
    .normalize('NFD')
    // bỏ dấu thanh và dấu phụ (combining diacritical marks)
    .replace(/[\u0300-\u036f]/g, '')
    // đ/Đ không phân rã trong NFD nên phải thay tay
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Trấn Thành" -> "tran-thanh". Slug là khoá định danh người trong URL. */
export function slugifyName(input: unknown): string {
  const slug = fold(input).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.slice(0, 120);
}

/** Gộp mọi tên của một phim thành một chuỗi để tìm kiếm không dấu. */
export function movieSearchText(...parts: unknown[]): string {
  return fold(parts.filter(Boolean).join(' '));
}
