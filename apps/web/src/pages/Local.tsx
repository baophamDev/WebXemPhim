import { useState } from 'react';
import { Search } from 'lucide-react';
import { useGetLocalMoviesQuery } from '../api';
import { Breadcrumb, EmptyState, ErrorState, MovieCard, Pagination, RailLabel, Shell, SkeletonGrid, useDebounced } from '../ui';

/** Kho đã lưu trong Postgres — lọc bằng chính cột không dấu ở backend. */
export default function LocalPage() {
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(draft.trim(), 350);
  const result = useGetLocalMoviesQuery({ q: q || undefined, sort: 'rating', page, limit: 24 });

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Thư viện', '/library'], ['Kho đã lưu', '']]} />
      <div className="page-title">
        <div>
          <RailLabel prefix="KHO">Đã đồng bộ</RailLabel>
          <h1>Kho phim đã lưu</h1>
          <p>{result.data?.pagination.totalItems ?? 0} phim phát được trong mạng nhà</p>
        </div>
        <label className="inline-search">
          <Search />
          <input value={draft} onChange={(event) => { setDraft(event.target.value); setPage(1); }} placeholder="Lọc kho đã lưu" aria-label="Lọc kho" />
        </label>
      </div>
      {result.isLoading ? <SkeletonGrid />
        : result.isError ? <ErrorState onRetry={result.refetch} />
        : result.data?.items.length
          ? <>
              <div className="movie-grid">{result.data.items.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
              <Pagination current={page} total={result.data.pagination.totalPages} onChange={setPage} />
            </>
          : <EmptyState title="Kho đang trống" message="Mở một phim rồi bấm “Làm mới nguồn” để lưu vào kho." />}
    </div>
  </Shell>;
}
