import { request } from '@/lib/api';
import type { HappyBite } from '@/lib/types';
import { parseHappyBite } from '@/lib/happy-bite-access';
export { parseHappyBite, happyBiteAsBook, HappyBiteAccessError } from '@/lib/happy-bite-access';

export const HAPPY_BITES_PAGE_SIZE = 20;

function displayOrder(items: HappyBite[]) {
  return [...items].sort((a, b) =>
    a.displayOrder - b.displayOrder ||
    (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0),
  );
}


let refreshSequence = 0;

export async function fetchHappyBites(page = 1, category?: string, force = false) {
  const params = new URLSearchParams({ page: String(page), limit: String(HAPPY_BITES_PAGE_SIZE) });
  if (category && category !== 'all') params.set('category', category);
  // Native HTTP stacks and proxies may reuse a URL despite fetch's cache option.
  // Each explicit refresh must fetch a fresh first page, including after edits/unpublishing.
  if (force) params.set('_refresh', `${Date.now()}-${++refreshSequence}`);
  const result = await request<{ items?: any[]; happyBites?: any[]; categories?: string[]; pagination?: { hasMore?: boolean; totalPages?: number } }>(
    `/happy-bites?${params.toString()}`, { cache: 'no-store' },
  );
  const source = result.items ?? result.happyBites ?? [];
  const items = source.map(parseHappyBite);
  return {
    items: displayOrder(items),
    categories: result.categories ?? [],
    hasMore: result.pagination?.hasMore ?? (result.pagination?.totalPages != null ? page < result.pagination.totalPages : items.length === HAPPY_BITES_PAGE_SIZE),
  };
}

export async function fetchAdminHappyBites() {
  const result = await request<{ items?: any[]; happyBites?: any[] }>('/admin/happy-bites');
  return displayOrder((result.items ?? result.happyBites ?? []).map(parseHappyBite));
}

export async function fetchHappyBite(id: string) {
  const result = await request<{ happyBite: unknown }>(`/happy-bites/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!result.happyBite) throw new Error('This Happy Bite is no longer available.');
  return parseHappyBite(result.happyBite);
}
