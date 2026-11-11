import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { apiErrorMessage } from '@/lib/api';
import { fetchHappyBites } from '@/lib/happy-bites';
import type { HappyBite } from '@/lib/types';

type HappyBitesValue = {
  items: HappyBite[];
  categories: string[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadFirst: (category?: string, force?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
};

const Context = createContext<HappyBitesValue | null>(null);

export function HappyBitesProvider({ children }: { children: React.ReactNode }) {
  const generation = useRef(0);
  const [items, setItems] = useState<HappyBite[]>([]);
  const [serverCategories, setServerCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const loadFirst = useCallback(async (nextCategory = 'all', force = false) => {
    const requestId = ++generation.current;
    setLoadingMore(false);
    setCategory(nextCategory);
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHappyBites(1, nextCategory);
      if (requestId !== generation.current) return;
      setItems(result.items);
      setServerCategories(result.categories);
      setHasMore(result.hasMore);
      setPage(1);
    } catch (exception) {
      if (requestId !== generation.current) return;
      setItems([]);
      setHasMore(false);
      setError(apiErrorMessage(exception));
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const requestId = generation.current;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await fetchHappyBites(nextPage, category);
      if (requestId !== generation.current) return;
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !known.has(item.id))];
      });
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (exception) {
      if (requestId === generation.current) setError(apiErrorMessage(exception));
    } finally {
      if (requestId === generation.current) setLoadingMore(false);
    }
  }, [category, hasMore, loading, loadingMore, page]);

  const categories = useMemo(() => ['all', ...new Set([...serverCategories, ...items.map((item) => item.category)].filter(Boolean))], [items, serverCategories]);
  const value = useMemo(() => ({ items, categories, loading, loadingMore, hasMore, error, loadFirst, loadMore }), [items, categories, loading, loadingMore, hasMore, error, loadFirst, loadMore]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useHappyBites() {
  const value = useContext(Context);
  if (!value) throw new Error('HappyBitesProvider is missing.');
  return value;
}
