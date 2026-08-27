import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { useGetPeopleQuery } from '../api';
import { Breadcrumb, EmptyState, ErrorState, Pagination, RailLabel, Shell, SkeletonGrid, useDebounced } from '../ui';

const kinds = [['', 'Tất cả'], ['actor', 'Diễn viên'], ['director', 'Đạo diễn']] as const;

/** Lọc ở backend (không dấu) thay vì tải cả danh sách rồi filter trên máy. */
export default function PeoplePage() {
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<'' | 'actor' | 'director'>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(draft.trim(), 350);
  const result = useGetPeopleQuery({ q: q || undefined, kind: kind || undefined, page, limit: 60 });
  const people = result.data?.items ?? [];

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Diễn viên', '']]} />
      <div className="page-title">
        <div>
          <RailLabel prefix="NGƯỜI">{kinds.find(([value]) => value === kind)?.[1]}</RailLabel>
          <h1>Diễn viên & đạo diễn</h1>
          <p>{result.data?.pagination.totalItems ?? 0} người trong kho</p>
        </div>
        <label className="inline-search">
          <Search />
          <input value={draft} onChange={(event) => { setDraft(event.target.value); setPage(1); }} placeholder="Tìm tên — không cần dấu" aria-label="Tìm người" />
        </label>
      </div>
      <div className="chip-row">
        {kinds.map(([value, label]) => <button key={value || 'all'} className={value === kind ? 'chip active' : 'chip'} onClick={() => { setKind(value); setPage(1); }}>{label}</button>)}
      </div>
      {result.isLoading ? <SkeletonGrid />
        : result.isError ? <ErrorState onRetry={result.refetch} />
        : people.length
          ? <>
              <div className="people-grid">
                {people.map((person) => <Link key={person.slug} to={`/person/${person.slug}`}>
                  <div>{person.thumbUrl ? <img src={person.thumbUrl} alt="" loading="lazy" decoding="async" /> : <Users />}</div>
                  <h3>{person.name}</h3>
                  <p>{person.movieCount} phim</p>
                </Link>)}
              </div>
              <Pagination current={page} total={result.data?.pagination.totalPages ?? 1} onChange={setPage} />
            </>
          : <EmptyState title="Không có ai khớp" message="Thử tên ngắn hơn, ví dụ “tran”." />}
    </div>
  </Shell>;
}
