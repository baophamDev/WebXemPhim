import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { useGetTaxonomyQuery } from '../api';
import { Breadcrumb, EmptyState, ErrorState, RailLabel, Shell, SkeletonGrid } from '../ui';

export default function ShowtimesPage() {
  const result = useGetTaxonomyQuery('codes');
  const [query, setQuery] = useState('');
  const codes = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (result.data?.items ?? []).filter((item) => !text || item.name.toLowerCase().includes(text)).slice(-160).reverse();
  }, [result.data, query]);

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Lịch phát hành', '']]} />
      <div className="page-title">
        <div>
          <RailLabel prefix="LỊCH">Theo mã ngày</RailLabel>
          <h1>Lịch phát hành</h1>
          <p>Chọn một mốc để xem phim thuộc mốc đó</p>
        </div>
        <label className="inline-search">
          <CalendarDays />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ 2025" aria-label="Lọc mốc thời gian" />
        </label>
      </div>
      {result.isLoading ? <SkeletonGrid />
        : result.isError ? <ErrorState onRetry={result.refetch} />
        : codes.length
          ? <div className="code-grid">
              {codes.map((code) => <Link key={`${code.id}-${code.slug}`} to={`/browse/code/${encodeURIComponent(code.slug)}`}>
                <CalendarDays /><span>{code.name}</span><ChevronRight />
              </Link>)}
            </div>
          : <EmptyState title="Không có mốc nào" message="Thử từ khoá khác." />}
    </div>
  </Shell>;
}
