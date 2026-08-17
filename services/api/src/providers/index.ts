import { vsmov } from '../vsmov.js';
import type { CatalogProvider } from './types.js';

const providers: Record<string, CatalogProvider> = { vsmov };
const providerName = (process.env.CATALOG_PROVIDER ?? 'vsmov').toLowerCase();

export const catalogProvider = providers[providerName];
if (!catalogProvider) throw new Error(`Unsupported CATALOG_PROVIDER: ${providerName}`);

export type { CatalogFilters, CatalogProvider } from './types.js';
