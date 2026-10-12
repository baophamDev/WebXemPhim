/**
 * Lấy chi tiết + nhóm tập của một phim thẳng từ nguồn, kèm **đổi nguồn bằng tay**.
 *
 * Thay cho `useGetMovieQuery` + `useNguoncDetail` cũ: giờ không còn backend, cả
 * trang Chi tiết lẫn trang Xem đều hỏi nguồn qua đây. `pref = 'auto'` thì tự chọn
 * nguồn phát được (ưu tiên m3u8); `pref` là một nguồn cụ thể thì ép đúng nguồn đó
 * (nút đổi nguồn khi một nguồn sập).
 *
 * Không đưa vào RTK Query: nó nhắm vào các endpoint `/catalog/*`, còn đây là lời
 * gọi nguồn có trạng thái riêng (nguồn đang dùng, đang đổi) — tách hook cho gọn.
 */
import { useEffect, useRef, useState } from 'react';
import type { TitleHint } from './match';
import {
  PLAYBACK_ORDER, SOURCES, SOURCE_IDS, fetchFromSource, resolveMovie,
  type ResolvedDetail, type SourceId
} from './sources';

/** `'auto'` = tự chọn; một `SourceId` = ép đúng nguồn người xem đã ghim. */
export type SourcePref = SourceId | 'auto';

export interface SourceDetailState {
  data: ResolvedDetail | null;
  error: string | null;
  isFetching: boolean;
  /** Nguồn thực sự đang phát (sau khi resolve); `null` khi chưa có dữ liệu. */
  sourceId: SourceId | null;
  /** Lựa chọn hiện tại: `'auto'` hoặc nguồn đã ghim. */
  pref: SourcePref;
  setSource: (pref: SourcePref) => void;
  sources: { id: SourceId; label: string }[];
}

const SOURCE_META = SOURCE_IDS.map((id) => ({ id, label: SOURCES[id].label }));

export function useSourceDetail(slug: string, hint: TitleHint | null, initial: SourcePref = 'auto'): SourceDetailState {
  const [pref, setPref] = useState<SourcePref>(initial);
  const [state, setState] = useState<{ data: ResolvedDetail | null; error: string | null; isFetching: boolean }>({
    data: null, error: null, isFetching: Boolean(slug)
  });
  const token = useRef(0);

  /**
   * Gợi ý tốt nhất đang biết. Khởi tạo lại khi đổi phim (slug), và lớn dần khi học
   * được tên thật từ nguồn đầu tiên — nhờ đó bấm đổi nguồn (slug khác hệ) vẫn khớp
   * phim theo tên.
   */
  const hintRef = useRef<TitleHint>({ name: hint?.name ?? '', originName: hint?.originName ?? null, year: hint?.year ?? null, slug });
  if (hintRef.current.slug !== slug) {
    hintRef.current = { name: hint?.name ?? '', originName: hint?.originName ?? null, year: hint?.year ?? null, slug };
  } else if (hint?.name && !hintRef.current.name) {
    hintRef.current = { ...hintRef.current, name: hint.name, originName: hint.originName ?? hintRef.current.originName, year: hint.year ?? hintRef.current.year };
  }

  useEffect(() => {
    if (!slug) { setState({ data: null, error: null, isFetching: false }); return; }
    const mine = ++token.current;
    setState((prev) => ({ ...prev, isFetching: true, error: null }));
    const run = pref === 'auto' ? resolveMovie(hintRef.current, PLAYBACK_ORDER) : fetchFromSource(pref, hintRef.current);
    run
      .then((result) => {
        if (token.current !== mine) return;
        if (!result) { setState({ data: null, error: 'Không nguồn nào có phim này để phát.', isFetching: false }); return; }
        // Học tên thật để lần đổi nguồn sau còn so khớp được.
        hintRef.current = { name: result.movie.name, originName: result.movie.originName, year: result.movie.year, slug };
        setState({ data: result, error: null, isFetching: false });
      })
      .catch((error: Error) => { if (token.current === mine) setState({ data: null, error: error.message, isFetching: false }); });
  }, [slug, pref]);

  return {
    ...state,
    sourceId: state.data?.sourceId ?? null,
    pref,
    setSource: setPref,
    sources: SOURCE_META
  };
}
