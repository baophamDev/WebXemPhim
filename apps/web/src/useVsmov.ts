/**
 * Hook gọi thẳng VSMOV từ trình duyệt (xem `src/vsmov.ts` vì sao đường này tồn tại).
 *
 * Không đưa vào RTK Query: baseQuery của cinemaApi aimed vào API của mình (kèm
 * cơ chế claimBoot), còn đây là nguồn ngoài hoàn toàn — tách hook riêng bằng
 * useState/useEffect cho hai chữ ký không lẫn vào nhau.
 */
import { useEffect, useRef, useState } from 'react';
import { apiIngestUrl } from './api';
import { vsmovDetail, vsmovSearch, type IngestPayload } from './vsmov';
import type { MovieList } from './types';

export interface VsmovQuery<T> {
  data: T | null;
  error: string | null;
  isFetching: boolean;
}

/** Số request đã bắn — chỉ nhận kết quả của request mới nhất (bỏ kết quả về trễ). */
export function useVsmovSearch(keyword: string, page: number, limit = 24, enabled = true): VsmovQuery<MovieList> {
  const [state, setState] = useState<VsmovQuery<MovieList>>({ data: null, error: null, isFetching: false });
  const token = useRef(0);
  useEffect(() => {
    if (!enabled || keyword.trim().length < 2) {
      setState({ data: null, error: null, isFetching: false });
      return;
    }
    const mine = ++token.current;
    setState((prev) => ({ ...prev, isFetching: true }));
    vsmovSearch(keyword.trim(), page, limit)
      .then((data) => { if (token.current === mine) setState({ data, error: null, isFetching: false }); })
      .catch((error: Error) => { if (token.current === mine) setState({ data: null, error: error.message, isFetching: false }); });
  }, [keyword, page, limit, enabled]);
  return state;
}

/**
 * Chi tiết một phim từ vsmov, kèm việc tự gửi về API (`ingest`) khi lấy được.
 * Ingest lỗi thì im lặng: việc xem không được chặn vì kho không ghi được — lần
 * tới nó sẽ thử lại.
 */
export function useVsmovDetail(slug: string, enabled: boolean): VsmovQuery<IngestPayload> & { ingested: boolean } {
  const [state, setState] = useState<VsmovQuery<IngestPayload>>({ data: null, error: null, isFetching: false });
  const [ingested, setIngested] = useState(false);
  const token = useRef(0);
  useEffect(() => {
    setIngested(false);
    if (!enabled || !slug) {
      setState({ data: null, error: null, isFetching: false });
      return;
    }
    const mine = ++token.current;
    setState((prev) => ({ ...prev, isFetching: true }));
    vsmovDetail(slug)
      .then(async (data) => {
        if (token.current !== mine) return;
        setState({ data, error: null, isFetching: false });
        try {
          const response = await fetch(apiIngestUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (response.ok) setIngested(true);
        } catch { /* kho không ghi được: vẫn xem được, thử lại lần sau */ }
      })
      .catch((error: Error) => { if (token.current === mine) setState({ data: null, error: error.message, isFetching: false }); });
  }, [slug, enabled]);
  return { ...state, ingested };
}
