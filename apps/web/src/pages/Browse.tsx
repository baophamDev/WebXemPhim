import { Check, ChevronDown, Eraser, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGetCatalogQuery, useGetNavigationQuery, useGetTaxonomyQuery } from '../api';
import { activeFilters, commitFilters, emptyFilters, FILTER_KEYS, filtersChanged, filtersEmpty, ROUTE_FILTER, STATUS_OPTIONS, TYPE_OPTIONS, type FilterKey, type Filters } from '../filters';
import type { CatalogKind, CatalogQuery, TaxonomyItem } from '../types';
import { Breadcrumb, EmptyState, ErrorState, humanize, listLabels, MovieCard, Pagination, RailLabel, Shell, SkeletonGrid } from '../ui';
import { useReveal } from '../ui/motion';

/**
 * Tham số của trang Khám Phá. Năm ô lọc chờ nút "Áp dụng" nên ở đây chỉ có `page`
 * đi thẳng vào URL; bộ lọc do `FilterBar` giữ nháp rồi gọi `apply`.
 */
function useCatalogParams(kind: CatalogKind, value: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const applied = activeFilters(kind, value, searchParams);
  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next > 1) params.set('page', String(next)); else params.delete('page');
    setSearchParams(params);
  };
  const apply = (draft: Filters) => {
    const target = commitFilters(kind, value, searchParams, draft);
    if (target.kind === 'path') navigate(target.path);
    else setSearchParams(target.params);
  };
  return { page, applied, goToPage, apply };
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
 * Ô chọn phải có một dòng cho giá trị đang xem, kể cả khi danh mục chưa tải được
 * hoặc bị cắt bớt (ô "Năm" chỉ hiện 50 năm gần nhất): không thì ô hiện "Tất cả"
 * trong khi trang vẫn đang lọc theo tiêu chí đó.
 */
function withCurrent(items: TaxonomyItem[], value: string): TaxonomyItem[] {
  if (!value || items.some((item) => item.slug === value)) return items;
  return [{ id: value, name: humanize(value), slug: value, thumbUrl: null }, ...items];
}

/**
 * Năm ô chọn của trang Khám Phá. Đổi ô chọn chỉ sửa bản nháp; bấm "Áp dụng" mới ghi
 * cả bộ vào URL trong một lượt — khỏi một request cho mỗi lần đổi, và người xem
 * chỉnh xong cả bộ rồi mới xem kết quả.
 *
 * Một request /catalog/navigation thay cho ba request thể loại/quốc gia/năm.
 * Đường lùi khi API còn bản cũ (chưa có /navigation, trả 404): gọi lại ba
 * route taxonomy cũ để dropdown không trắng. API mới thì ba query này skip,
 * không tốn request nào thêm.
 */
function FilterBar({ applied, onApply }: { applied: Filters; onApply: (draft: Filters) => void }) {
  const nav = useGetNavigationQuery();
  const legacy = nav.isError;
  const genres = useGetTaxonomyQuery('genres', { skip: !legacy });
  const countries = useGetTaxonomyQuery('countries', { skip: !legacy });
  const years = useGetTaxonomyQuery('years', { skip: !legacy });
  const genreItems = nav.data?.genres ?? genres.data?.items ?? [];
  const countryItems = nav.data?.countries ?? countries.data?.items ?? [];
  const yearItems = nav.data?.years ?? years.data?.items ?? [];

  const [draft, setDraft] = useState(applied);
  // URL đổi từ bên ngoài (menu Khám phá, nút Back, phân trang) thì bản nháp đi
  // theo. So bằng chuỗi vì `applied` là object mới ở mỗi lần render.
  const appliedKey = FILTER_KEYS.map((key) => applied[key]).join('\u0001');
  const [seen, setSeen] = useState(appliedKey);
  if (seen !== appliedKey) {
    setSeen(appliedKey);
    setDraft(applied);
  }

  const change = (key: FilterKey, next: string) => setDraft((current) => ({ ...current, [key]: next }));
  return <div className="filter-bar">
    <span className="filter-label"><SlidersHorizontal />Bộ lọc</span>
    <SelectFilter label="Thể loại" value={draft.category} items={withCurrent(genreItems, draft.category)} onChange={(next) => change('category', next)} />
    <SelectFilter label="Quốc gia" value={draft.country} items={withCurrent(countryItems, draft.country)} onChange={(next) => change('country', next)} />
    <SelectFilter label="Năm" value={draft.year} items={withCurrent(yearItems.slice(0, 50), draft.year)} onChange={(next) => change('year', next)} />
    <SelectFilter label="Định dạng" value={draft.type} items={withCurrent(TYPE_OPTIONS, draft.type)} onChange={(next) => change('type', next)} />
    <SelectFilter label="Trạng thái" value={draft.status} items={withCurrent(STATUS_OPTIONS, draft.status)} onChange={(next) => change('status', next)} />
    <div className="filter-actions">
      {filtersEmpty(draft) ? null : <button className="button ghost" type="button" onClick={() => setDraft(emptyFilters())}><Eraser />Xoá lọc</button>}
      <button className="button primary" type="button" disabled={!filtersChanged(draft, applied)} onClick={() => onApply(draft)}><Check />Áp dụng</button>
    </div>
  </div>;
}

export default function Browse() {
  const { kind = 'list', value = 'phim-moi-cap-nhat' } = useParams();
  const safeKind = (['list', 'genre', 'country', 'year'].includes(kind) ? kind : 'list') as CatalogKind;
  const { page, applied, goToPage, apply } = useCatalogParams(safeKind, value);
  const query: CatalogQuery = { kind: safeKind, value, page, limit: 24 };
  for (const key of FILTER_KEYS) if (applied[key]) query[key] = applied[key];
  // Không gửi lại tiêu chí đã nằm trong đường dẫn, provider sẽ hiểu sai bộ lọc.
  const carried = ROUTE_FILTER[safeKind];
  if (carried) delete query[carried.key];
  const result = useGetCatalogQuery(query);
  const title = safeKind === 'list' ? listLabels[value] ?? 'Khám phá phim'
    : safeKind === 'genre' ? humanize(value)
    : safeKind === 'country' ? `Phim ${humanize(value)}`
    : `Phim năm ${value}`;
  const grid = useReveal<HTMLDivElement>(26, [safeKind, value, page, applied.category, applied.country, applied.year, applied.type, applied.status]);
  const label = safeKind === 'genre' ? 'THỂ LOẠI' : safeKind === 'country' ? 'QUỐC GIA' : safeKind === 'year' ? 'NĂM' : 'DANH SÁCH';

  return <Shell>
    <div className="page-container page-top">
      <Breadcrumb items={[['Trang chủ', '/'], ['Khám phá', '/browse/list/phim-chieu-rap'], [title, '']]} />
      <div className="page-title">
        <div>
          <RailLabel prefix={label}>{title}</RailLabel>
          <h1>{title}</h1>
          <p>{result.data?.pagination.totalItems ?? 0} phim</p>
        </div>
      </div>
      <FilterBar applied={applied} onApply={apply} />
      {result.isLoading ? <SkeletonGrid />
        : result.isError ? <ErrorState onRetry={result.refetch} />
        : result.data?.items.length
          ? <>
              <div className="movie-grid" ref={grid}>{result.data.items.map((movie, index) => <MovieCard key={`${movie.slug}-${index}`} movie={movie} />)}</div>
              <Pagination current={page} total={result.data.pagination.totalPages} onChange={goToPage} />
            </>
          : <EmptyState />}
    </div>
  </Shell>;
}
