/**
 * Nguồn catalog duy nhất: VSMOV.
 *
 * Không còn tầng adapter đa nguồn (resolver, fallback, circuit breaker, bồi
 * metadata TMDB/TVDB, nguồn web theo slug). Mọi route gọi thẳng `vsmov` và
 * validate shape ở biên bằng `normalize.ts`.
 */
import { checkDetail, checkList, checkTaxonomy } from './normalize.js';
import type { CatalogFilters } from './types.js';
import { vsmov } from './vsmov.js';

const SOURCE = 'vsmov';

export const catalog = {
  names: [SOURCE],
  latest: async (page: number) => ({
    ...(checkList(SOURCE, await vsmov.latest(page))),
    source: SOURCE
  }),
  home: async (filters: CatalogFilters = {}) => ({
    ...(checkList(SOURCE, await vsmov.home(filters))),
    source: SOURCE
  }),
  listBySlug: async (slug: string, filters: CatalogFilters = {}) => ({
    ...(checkList(SOURCE, await vsmov.list(slug, filters))),
    source: SOURCE
  }),
  search: async (keyword: string, filters: CatalogFilters = {}) => ({
    ...(checkList(SOURCE, await vsmov.search(keyword, filters))),
    source: SOURCE
  }),
  genres: async () => ({
    ...(checkTaxonomy(SOURCE, await vsmov.genres())),
    source: SOURCE
  }),
  byGenre: async (slug: string, filters: CatalogFilters = {}) => ({
    ...(checkList(SOURCE, await vsmov.byGenre(slug, filters))),
    source: SOURCE
  }),
  countries: async () => ({
    ...(checkTaxonomy(SOURCE, await vsmov.countries())),
    source: SOURCE
  }),
  byCountry: async (slug: string, filters: CatalogFilters = {}) => ({
    ...(checkList(SOURCE, await vsmov.byCountry(slug, filters))),
    source: SOURCE
  }),
  years: async () => ({
    ...(checkTaxonomy(SOURCE, await vsmov.years())),
    source: SOURCE
  }),
  byYear: async (year: string, filters: CatalogFilters = {}) => ({
    ...(checkList(SOURCE, await vsmov.byYear(year, filters))),
    source: SOURCE
  }),
  actors: async () => ({
    ...(checkTaxonomy(SOURCE, await vsmov.actors())),
    source: SOURCE
  }),
  codes: async () => ({
    ...(checkTaxonomy(SOURCE, await vsmov.codes())),
    source: SOURCE
  }),
  byCode: async (code: string, filters: CatalogFilters = {}) => ({
    ...(checkList(SOURCE, await vsmov.byCode(code, filters))),
    source: SOURCE
  }),
  detail: async (slug: string, report?: (stage: 'loading', source: string | null) => void) => {
    report?.('loading', SOURCE);
    const detail = checkDetail(SOURCE, await vsmov.detail(slug));
    return { ...detail, source: SOURCE };
  }
};

console.log('[catalog] nguồn duy nhất: vsmov');

export type {
  CatalogFilters, ListPage, MovieSummary, SourceDetail, Taxonomy, VsmovDetail
} from './types.js';
