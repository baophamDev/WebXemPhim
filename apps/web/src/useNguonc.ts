/**
 * Hook gọi thẳng NguonC từ trình duyệt (xem `src/nguonc.ts` vì sao đường này tồn
 * tại và vì sao nó thay VSMOV ở đây).
 *
 * Không đưa vào RTK Query: baseQuery của cinemaApi nhắm vào API của mình (kèm cơ
 * chế claimBoot), còn đây là nguồn ngoài hoàn toàn — tách hook riêng bằng
 * useState/useEffect cho hai chữ ký không lẫn vào nhau.
 */
import { useEffect, useRef, useState } from 'react';
import { apiIngestUrl } from './api';
import { nguoncDetail, nguoncSearch } from './nguonc';
import type { IngestPayload } from './vsmov';
import type { MovieList } from './types';

export interface NguoncQuery<T> {
  data: T | null;
  error: string | null;
  isFetching: boolean;
}

/** Số request đã bắn — chỉ nhận kết quả của request mới nhất (bỏ kết quả về trễ). */
export function useNguoncSearch(keyword: string, page: number, limit = 24, enabled = true): NguoncQuery<MovieList> {
  const [state, setState] = useState<NguoncQuery<MovieList>>({ data: null, error: null, isFetching: false });
  const token = useRef(0);
  useEffect(() => {
    if (!enabled || keyword.trim().length < 2) {
      setState({ data: null, error: null, isFetching: false });
      return;
    }
    const mine = ++token.current;
    setState((prev) => ({ ...prev, isFetching: true }));
    nguoncSearch(keyword.trim(), page, limit)
      .then((data) => { if (token.current === mine) setState({ data, error: null, isFetching: false }); })
      .catch((error: Error) => { if (token.current === mine) setState({ data: null, error: error.message, isFetching: false }); });
  }, [keyword, page, limit, enabled]);
  return state;
}

/**
 * Chi tiết một phim từ NguonC.
 *
 * `ingest` chỉ bật khi phim **chưa có trong kho**: gửi bản NguonC về để lần sau mở
 * là có ngay. Phim đã có trong kho thì để job nhập ở nền của API lo (nó ưu tiên
 * m3u8 thật của KKPhim), client gửi đè lên là tranh nhau ghi.
 */
export function useNguoncDetail(slug: string, enabled: boolean, ingest = true): NguoncQuery<IngestPayload> & { ingested: boolean } {
  const [state, setState] = useState<NguoncQuery<IngestPayload>>({ data: null, error: null, isFetching: false });
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
    nguoncDetail(slug)
      .then(async (data) => {
        if (token.current !== mine) return;
        setState({ data, error: null, isFetching: false });
        if (!ingest) return;
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
  }, [slug, enabled, ingest]);
  return { ...state, ingested };
}