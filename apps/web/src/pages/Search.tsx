import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Database, Search, Users } from 'lucide-react';
import { useSearchAllQuery } from '../api';
import { useNguoncSearch } from '../useNguonc';
import { rememberMovies } from '../preview';
import { Breadcrumb, EmptyState, ErrorState, MovieCard, Pagination, RailLabel, Shell, SkeletonGrid, useDebounced } from '../ui';

/**
 * Một khung tìm kiếm cho cả phim và người.
 *
 * `auto`: ưu tiên kho đã lưu vì nó khớp không dấu ("tran thanh" ra "Trấn Thành")
 * và tìm được theo tên diễn viên; song song đó hỏi thẳng NguonC từ trình duyệt
 * (nguồn này trả `Access-Control-Allow-Origin: *`, lại có embed thật) để kết quả
 * không phụ thuộc kho đã có gì.
 * `nguonc`: bỏ qua kho, chỉ xem kết quả nguồn.
 *
 * Kết quả NguonC được ghi lại vào kho tạm (`rememberMovies`) để trang chi tiết
 * bấm vào là có poster ngay; bản đầy đủ sẽ do trang chi tiết kéo về.
 */
type Source = 'auto' | 'nguonc';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const [source, setSource] = useState<Source>(params.get('src') === 'nguonc' ? 'nguonc' : 'auto');
  const [page, setPage] = useState(1);
  const q = useDebounced(draft.trim(), 350);
  useEffect(() => {
    setParams(q ? (source === 'nguonc' ? { q, src: 'nguonc' } : { q }) : {}, { replace: true });
    setPage(1);
  }, [q, source]);

  const local = useSearchAllQuery({ q, page, limit: 24 }, { skip: source === 'nguonc' || q.length < 1 });
  const remote = useNguoncSearch(q, page, 24, q.length >= 2);
  const people = local.data?.people ?? [];

  // Chọn nguồn hiển thị: auto thì NguonC là chính (luồng thật), chỉ về kho khi
  // nguồn đang lỗi — người dùng vẫn có kết quả trong khi nguồn chết.
  const useRemote = source === 'nguonc' || !remote.error;
  const chosen = useRemote ? remote.data : local.data?.movies ?? null;
  const busy = useRemote ? remote.isFetching : local.isFetching;
  const failed = useRemote ? Boolean(remote.error) : local.isError;
  const movies = chosen;
  useEffect(() => { if (movies?.items.length) rememberMovies(movies.items); }, [movies]);

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Tìm kiếm', '']]} />
      <form className="search-hero" onSubmit={(event) => event.preventDefault()} role="search">
        <Search />
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tên phim hoặc tên diễn viên" aria-label="Từ khoá" />
      </form>
      <div className="page-title">
        <div>
          <RailLabel prefix="TÌM KIẾM">{useRemote ? 'Nguồn NguonC' : 'Kho đã lưu'}</RailLabel>
          <h1>{q ? `“${q}”` : 'Tìm gì hôm nay?'}</h1>
          <p>{movies?.pagination.totalItems ?? 0} phim · {people.length} người</p>
        </div>
        <div className="chip-row" role="group" aria-label="Nguồn tìm kiếm">
          <button type="button" className={source === 'auto' ? 'chip active' : 'chip'} onClick={() => setSource('auto')}>
            <Database /> Tìm tất cả
          </button>
          <button type="button" className={source === 'nguonc' ? 'chip active' : 'chip'} onClick={() => setSource('nguonc')}>
            <Search /> Chỉ nguồn NguonC
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
          : q.length < 2 ? <EmptyState title="Từ khoá quá ngắn" message="Nguồn NguonC cần từ khoá từ 2 ký tự." />
          : busy && !movies ? <SkeletonGrid />
          : failed ? <ErrorState message={useRemote ? (remote.error ?? undefined) : undefined} onRetry={() => setPage(1)} />
          : movies?.items.length
            ? <>
                <div className="movie-grid">{movies.items.map((movie, index) => <MovieCard key={`${movie.slug}-${index}`} movie={movie} />)}</div>
                <Pagination current={page} total={movies.pagination.totalPages} onChange={setPage} />
              </>
            : <EmptyState title="Không có phim nào khớp" message="Thử từ khoá ngắn hơn hoặc đổi sang kho đã lưu." />}
      </section>
    </div>
  </Shell>;
}
