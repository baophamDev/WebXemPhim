import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useGetCatalogQuery, useGetNavigationQuery, useGetTaxonomyQuery } from '../api';
import type { CatalogKind, CatalogQuery, TaxonomyItem } from '../types';
import { Breadcrumb, EmptyState, ErrorState, humanize, listLabels, MovieCard, Pagination, RailLabel, Shell, SkeletonGrid } from '../ui';

const typeOptions: TaxonomyItem[] = [
  { id: 'single', name: 'Phim lẻ', slug: 'single', thumbUrl: null },
  { id: 'series', name: 'Phim bộ', slug: 'series', thumbUrl: null },
  { id: 'hoathinh', name: 'Hoạt hình', slug: 'hoathinh', thumbUrl: null },
  { id: 'tvshows', name: 'TV Shows', slug: 'tvshows', thumbUrl: null }
];
const statusOptions: TaxonomyItem[] = [
  { id: 'ongoing', name: 'Đang chiếu', slug: 'ongoing', thumbUrl: null },
  { id: 'completed', name: 'Hoàn thành', slug: 'completed', thumbUrl: null },
  { id: 'trailer', name: 'Trailer', slug: 'trailer', thumbUrl: null }
];

function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const filters = {
    page, limit: 24,
    year: searchParams.get('year') || undefined,
    country: searchParams.get('country') || undefined,
    category: searchParams.get('category') || undefined,
    type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined
  };
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };
  return { page, filters, update };
}

function SelectFilter({ label, value, items, onChange }: { label: string; value: string; items: TaxonomyItem[]; onChange: (value: string) => void }) {
  return <label className="select-control">
    <span>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Tất cả</option>
      {items.map((item) => <option key={`${item.id}-${item.slug}`} value={item.slug}>{item.name}</option>)}
    </select>
    <ChevronDown />
  </label>;
}

/**
 * Một request /catalog/navigation thay cho ba request thể loại/quốc gia/năm.
 * Đường lùi khi API còn bản cũ (chưa có /navigation, trả 404): gọi lại ba
 * route taxonomy cũ để dropdown không trắng. API mới thì ba query này skip,
 * không tốn request nào thêm.
 */
function FilterBar({ filters, update }: { filters: Record<string, any>; update: (key: string, value: string) => void }) {
  const nav = useGetNavigationQuery();
  const legacy = nav.isError;
  const genres = useGetTaxonomyQuery('genres', { skip: !legacy });
  const countries = useGetTaxonomyQuery('countries', { skip: !legacy });
  const years = useGetTaxonomyQuery('years', { skip: !legacy });
  const genreItems = nav.data?.genres ?? genres.data?.items ?? [];
  const countryItems = nav.data?.countries ?? countries.data?.items ?? [];
  const yearItems = nav.data?.years ?? years.data?.items ?? [];
  return <div className="filter-bar">
    <span className="filter-label"><SlidersHorizontal />Bộ lọc</span>
    <SelectFilter label="Thể loại" value={filters.category ?? ''} items={genreItems} onChange={(v) => update('category', v)} />
    <SelectFilter label="Quốc gia" value={filters.country ?? ''} items={countryItems} onChange={(v) => update('country', v)} />
    <SelectFilter label="Năm" value={filters.year ?? ''} items={yearItems.slice(0, 50)} onChange={(v) => update('year', v)} />
    <SelectFilter label="Định dạng" value={filters.type ?? ''} items={typeOptions} onChange={(v) => update('type', v)} />
    <SelectFilter label="Trạng thái" value={filters.status ?? ''} items={statusOptions} onChange={(v) => update('status', v)} />
  </div>;
}

export default function Browse() {
  const { kind = 'list', value = 'phim-moi-cap-nhat' } = useParams();
  const safeKind = (['list', 'genre', 'country', 'year', 'code'].includes(kind) ? kind : 'list') as CatalogKind;
  const { page, filters, update } = useCatalogParams();
  const query: CatalogQuery = { kind: safeKind, value, ...filters };
  // Không gửi lại tiêu chí đã nằm trong đường dẫn, provider sẽ hiểu sai bộ lọc.
  if (safeKind === 'year') delete query.year;
  if (safeKind === 'country') delete query.country;
  if (safeKind === 'genre') delete query.category;
  const result = useGetCatalogQuery(query);
  const title = safeKind === 'list' ? listLabels[value] ?? 'Khám phá phim'
    : safeKind === 'genre' ? humanize(value)
    : safeKind === 'country' ? `Phim ${humanize(value)}`
    : safeKind === 'year' ? `Phim năm ${value}`
    : `Lịch phát hành ${decodeURIComponent(value)}`;
  const label = safeKind === 'genre' ? 'THỂ LOẠI' : safeKind === 'country' ? 'QUỐC GIA' : safeKind === 'year' ? 'NĂM' : 'DANH SÁCH';

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Khám phá', '/browse/list/dang-chieu'], [title, '']]} />
      <div className="page-title">
        <div>
          <RailLabel prefix={label}>{title}</RailLabel>
          <h1>{title}</h1>
          <p>{result.data?.pagination.totalItems ?? 0} phim</p>
        </div>
      </div>
      <FilterBar filters={filters} update={update} />
      {result.isLoading ? <SkeletonGrid />
        : result.isError ? <ErrorState onRetry={result.refetch} />
        : result.data?.items.length
          ? <>
              <div className="movie-grid">{result.data.items.map((movie, index) => <MovieCard key={`${movie.slug}-${index}`} movie={movie} />)}</div>
              <Pagination current={page} total={result.data.pagination.totalPages} onChange={(next) => update('page', String(next))} />
            </>
          : <EmptyState />}
    </div>
  </Shell>;
}
