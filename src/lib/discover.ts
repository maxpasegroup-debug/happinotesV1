import { fetchHappyBites } from '@/lib/happy-bites';
import type { Book, HappyBite } from '@/lib/types';

export type DiscoverFilter = 'books' | 'bites' | 'both';
export type DiscoverItem = { kind: 'book'; item: Book } | { kind: 'bite'; item: HappyBite };

// The public Bites endpoint is paginated and has no text-search parameter.
// Search every published page, rather than silently searching only the first 20.
export async function fetchDiscoverBites(isActive: () => boolean) {
  const items = new Map<string, HappyBite>();
  for (let page = 1; isActive(); page += 1) {
    const result = await fetchHappyBites(page, 'all', true);
    if (!isActive()) return [];
    for (const item of result.items) items.set(item.id, item);
    if (!result.hasMore) break;
  }
  return [...items.values()];
}

export function filterDiscover(books: Book[], bites: HappyBite[], filter: DiscoverFilter, query: string): DiscoverItem[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (item: Book | HappyBite) => {
    const text = `${item.title} ${item.description} ${item.category} ${'language' in item ? item.language : ''}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  };
  const bookResults: DiscoverItem[] = filter === 'bites' ? [] : books.filter(matches).map((item) => ({ kind: 'book', item }));
  const biteResults: DiscoverItem[] = filter === 'books' ? [] : bites.filter(matches).map((item) => ({ kind: 'bite', item }));
  // Interleave in Both so short bites remain discoverable alongside the books.
  if (filter !== 'both') return [...bookResults, ...biteResults];
  return Array.from({ length: Math.max(bookResults.length, biteResults.length) }, (_, index) =>
    [bookResults[index], biteResults[index]].filter(Boolean),
  ).flat();
}
