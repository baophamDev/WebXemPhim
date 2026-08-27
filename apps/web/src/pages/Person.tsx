import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LoaderCircle, Users } from 'lucide-react';
import { useGetPersonQuery } from '../api';
import { Breadcrumb, EmptyState, ErrorState, MovieCard, Pagination, RailLabel, Shell } from '../ui';

const kinds = [['', 'Tất cả'], ['actor', 'Vai diễn'], ['director', 'Đạo diễn']] as const;

/** Trang người: một request trả cả thông tin người và filmography có phân trang. */
export default function Person() {
  const { slug = '' } = useParams();
  const [kind, setKind] = useState<'' | 'actor' | 'director'>('');
  const [page, setPage] = useState(1);
  const result = useGetPersonQuery({ slug, page, kind: kind || undefined });

  if (result.isLoading) return <Shell><div className="full-loader"><LoaderCircle className="spin" /></div></Shell>;
  if (result.isError || !result.data?.person) {
    return <Shell><div className="page-container page-top"><ErrorState onRetry={result.refetch} message="Không tìm thấy người này trong kho." /></div></Shell>;
  }
  const { person, items, pagination } = result.data;

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Diễn viên', '/people'], [person.name, '']]} />
      <div className="person-head">
        <div>{person.thumbUrl ? <img src={person.thumbUrl} alt="" fetchPriority="high" decoding="async" /> : <Users />}</div>
        <div>
          <RailLabel prefix="NGƯỜI">{person.kinds?.includes('director') ? 'Đạo diễn' : 'Diễn viên'}</RailLabel>
          <h1>{person.name}</h1>
          <p>{person.movieCount} phim trong kho</p>
          <div className="chip-row">
            {kinds.map(([value, label]) => <button key={value || 'all'} className={value === kind ? 'chip active' : 'chip'} onClick={() => { setKind(value); setPage(1); }}>{label}</button>)}
          </div>
        </div>
      </div>
      <section className="library-section">
        <div className="section-heading"><div><RailLabel prefix="MỤC">Phim tham gia</RailLabel><h2>Filmography</h2></div></div>
        {items.length
          ? <>
              <div className="movie-grid">{items.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
              <Pagination current={page} total={pagination.totalPages} onChange={setPage} />
            </>
          : <EmptyState title="Chưa có phim nào" message="Kho chưa lưu phim nào của người này." />}
      </section>
    </div>
  </Shell>;
}
