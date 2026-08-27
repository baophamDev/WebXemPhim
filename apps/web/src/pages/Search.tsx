import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { useSearchAllQuery, useSearchCatalogQuery } from '../api';
import { Breadcrumb, EmptyState, ErrorState, MovieCard, Pagination, RailLabel, Shell, SkeletonGrid, useDebounced } from '../ui';

/**
 * Một khung tìm kiếm cho cả phim và người. Ưu tiên kho đã lưu vì nó khớp
 * không dấu ("tran thanh" ra "Trấn Thành") và tìm được cả theo tên diễn viên;
 * chỉ khi kho không có gì mới hỏi sang nguồn phim bên ngoài.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const [page, setPage] = useState(1);
  const q = useDebounced(draft.trim(), 350);
  useEffect(() => { setParams(q ? { q } : {}, { replace: true }); setPage(1); }, [q]);

  const local = useSearchAllQuery({ q, page, limit: 24 }, { skip: q.length < 1 });
  const emptyLocally = local.isSuccess && local.data.movies.items.length === 0;
  const remote = useSearchCatalogQuery({ q, page, limit: 24 }, { skip: !emptyLocally || q.length < 2 });
  const people = local.data?.people ?? [];
  const movies = emptyLocally ? remote.data : local.data?.movies;
  const busy = local.isFetching || remote.isFetching;

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Tìm kiếm', '']]} />
      <form className="search-hero" onSubmit={(event) => event.preventDefault()} role="search">
        <Search />
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tên phim hoặc tên diễn viên" aria-label="Từ khoá" />
      </form>
      <div className="page-title">
        <div>
          <RailLabel prefix="TÌM KIẾM">{emptyLocally ? 'Nguồn ngoài' : 'Kho đã lưu'}</RailLabel>
          <h1>{q ? `“${q}”` : 'Tìm gì hôm nay?'}</h1>
          <p>{movies?.pagination.totalItems ?? 0} phim · {people.length} người</p>
        </div>
      </div>

      {people.length ? <section className="library-section">
        <div className="section-heading"><div><RailLabel prefix="MỤC">Diễn viên & đạo diễn</RailLabel><h2>Người khớp tên</h2></div></div>
        <div className="people-grid">
          {people.map((person) => <Link key={person.slug} to={`/person/${person.slug}`}>
            <div>{person.thumbUrl ? <img src={person.thumbUrl} alt="" loading="lazy" decoding="async" /> : <Users />}</div>
            <h3>{person.name}</h3>
            <p>{person.movieCount} phim</p>
          </Link>)}
        </div>
      </section> : null}

      <section className="library-section">
        {q ? <div className="section-heading"><div><RailLabel prefix="MỤC">Phim</RailLabel><h2>Kết quả</h2></div></div> : null}
        {!q ? <EmptyState title="Nhập từ khoá" message="Tìm theo tên phim, tên gốc, hoặc tên diễn viên — không cần dấu." />
          : busy && !movies ? <SkeletonGrid />
          : local.isError ? <ErrorState onRetry={local.refetch} />
          : movies?.items.length
            ? <>
                <div className="movie-grid">{movies.items.map((movie, index) => <MovieCard key={`${movie.slug}-${index}`} movie={movie} />)}</div>
                <Pagination current={page} total={movies.pagination.totalPages} onChange={setPage} />
              </>
            : <EmptyState title="Không có phim nào khớp" message="Thử từ khoá ngắn hơn, hoặc bấm vào một diễn viên phía trên." />}
      </section>
    </div>
  </Shell>;
}
