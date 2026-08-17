export interface CatalogFilters {
  page?: number;
  limit?: number;
  year?: string;
  country?: string;
  category?: string;
  type?: string;
  status?: string;
}

export interface CatalogProvider {
  readonly name: string;
  latest(page: number, limit?: number): Promise<any>;
  home(filters?: CatalogFilters): Promise<any>;
  list(slug: string, filters?: CatalogFilters): Promise<any>;
  search(keyword: string, filters?: CatalogFilters): Promise<any>;
  genres(): Promise<any>;
  byGenre(slug: string, filters?: CatalogFilters): Promise<any>;
  countries(): Promise<any>;
  byCountry(slug: string, filters?: CatalogFilters): Promise<any>;
  years(): Promise<any>;
  byYear(year: string, filters?: CatalogFilters): Promise<any>;
  actors(): Promise<any>;
  codes(): Promise<any>;
  byCode(code: string, filters?: CatalogFilters): Promise<any>;
  detail(slug: string): Promise<any>;
}
