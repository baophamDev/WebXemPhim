export interface FilmSource {
  id: string;
  label: string;
  baseUrl: string;
}

/** Các trang dùng cùng quy ước /phim/<slug>; không lưu URL theo từng phim. */
export const filmSources: FilmSource[] = [
  { id: 'motchillu', label: 'MotChill U', baseUrl: 'https://motchillu.app' },
  { id: 'motchillv', label: 'MotChill V', baseUrl: 'https://motchillv.mx' },
  { id: 'phim4k', label: 'Phim4K', baseUrl: 'https://phim4k.top' },
  { id: 'phimmoichill', label: 'PhimMoiChill', baseUrl: 'https://phimmoichill.sh' },
  { id: 'phimmoichill-win', label: 'PhimMoiChill Win', baseUrl: 'https://phimmoichill.win' },
  { id: 'vieflix', label: 'VieFlix', baseUrl: 'https://vieflix.top' }
];

export function filmSourceUrl(source: FilmSource, slug: string) {
  return `${source.baseUrl}/phim/${encodeURIComponent(slug)}`;
}
