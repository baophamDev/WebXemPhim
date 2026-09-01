import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Database, Globe, Search, Users } from 'lucide-react';
import { useSearchAllQuery, useSearchCatalogQuery } from '../api';
import { Breadcrumb, EmptyState, ErrorState, MovieCard, Pagination, RailLabel, Shell, SkeletonGrid, useDebounced } from '../ui';

/**
 * Một khung tìm kiếm cho cả phim và người.
 *
 * `auto`: ưu tiên kho đã lưu vì nó khớp không dấu ("tran thanh" ra "Trấn Thành")
 * và tìm được theo tên diễn viên; chỉ khi kho không có gì mới hỏi sang vsmov.
 * `vsmov`: gọi thẳng `/api/catalog/search` → `/tim-kiem?keyword=` của vsmov.
 * Trước đây chỉ có nhánh auto, nên khi kho có đúng 1 phim khớp lệch là không bao
 * giờ thấy được catalog đầy đủ của vsmov — giờ chọn nguồn được bằng tay.
 */
type Source = 'auto' | 'vsmov';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const [source, setSource] = useState<Source>(params.get('src') === 'vsmov' ? 'vsmov' : 'auto');
  const [page, setPage] = useState(1);
  const q = useDebounced(draft.trim(), 350);
  useEffect(() => {
    setParams(q ? (source === 'vsmov' ? { q, src: 'vsmov' } : { q }) : {}, { replace: true });
    setPage(1);
  }, [q, source]);

  const local = useSearchAllQuery({ q, page, limit: 24 }, { skip: source === 'vsmov' || q.length < 1 });
  // Kho không trả gì HOẶC gọi kho lỗi thì vẫn thử nguồn ngoài, thay vì chỉ khi isSuccess.
  const localDone = local.isSuccess || local.isError;
  const fallback = source === 'auto' && localDone && (local.isError || local.data?.movies.items.length === 0);
  const useRemote = source === 'vsmov' || fallback;
  const remote = useSearchCatalogQuery({ q, page, limit: 24 }, { skip: !useRemote || q.length < 2 });
  const people = local.data?.people ?? [];
  const movies = useRemote ? remote.data : local.data?.movies;
  const busy = local.isFetching || remote.isFetching;
  const failed = useRemote ? remote.isError : local.isError;
  const retry = useRemote ? remote.refetch : local.refetch;

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Tìm kiếm', '']]} />
      <form className="search-hero" onSubmit={(event) => event.preventDefault()} role="search">
        <Search />
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tên phim hoặc tên diễn viên" aria-label="Từ khoá" />
      </form>
      <div className="page-title">
        <div>
          <RailLabel prefix="TÌM KIẾM">{useRemote ? 'Nguồn vsmov' : 'Kho đã lưu'}</RailLabel>
          <h1>{q ? `“${q}”` : 'Tìm gì hôm nay?'}</h1>
          <p>{movies?.pagination.totalItems ?? 0} phim · {people.length} người</p>
        </div>
        <div className="chip-row" role="group" aria-label="Nguồn tìm kiếm">
          <button type="button" className={source === 'auto' ? 'chip active' : 'chip'} onClick={() => setSource('auto')}>
            <Database /> Kho đã lưu
          </button>
          <button type="button" className={source === 'vsmov' ? 'chip active' : 'chip'} onClick={() => setSource('vsmov')}>
            <Globe /> vsmov
          </button>
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
          : failed ? <ErrorState onRetry={retry} />
          : movies?.items.length
            ? <>
                <div className="movie-grid">{movies.items.map((movie, index) => <MovieCard key={`${movie.slug}-${index}`} movie={movie} />)}</div>
                <Pagination current={page} total={movies.pagination.totalPages} onChange={setPage} />
              </>
            : <EmptyState title="Không có phim nào khớp" message={useRemote ? 'Nguồn vsmov cần từ khoá từ 2 ký tự. Thử từ khoá ngắn hơn hoặc đổi sang kho đã lưu.' : 'Thử từ khoá ngắn hơn, bấm vào một diễn viên phía trên, hoặc đổi nguồn sang vsmov.'} />}
      </section>
    </div>
  </Shell>;
}
