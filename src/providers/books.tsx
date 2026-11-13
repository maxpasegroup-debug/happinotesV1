import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  apiErrorMessage,
  fetchBooks,
  fetchCollection,
  fetchUpcomingBooks,
  collectionItemPath,
  request,
} from "@/lib/api";
import type { Book } from "@/lib/types";

type LoadBooksOptions = {
  query?: string;
  language?: string;
  forceRefresh?: boolean;
};

type BooksContextValue = {
  books: Book[];
  upcoming: Book[];
  library: Book[];
  savingIds: string[];
  loading: boolean;
  collectionLoading: boolean;
  collectionLoaded: boolean;
  collectionError: string | null;
  hasLoaded: boolean;
  error: string | null;
  activeQuery: string;
  activeLanguage: string;
  loadBooks: (options?: LoadBooksOptions) => Promise<Book[]>;
  loadCollection: (forceRefresh?: boolean) => Promise<void>;
  resolveBook: (id: string) => Promise<Book | null>;
  addToCollection: (book: Book) => Promise<string | null>;
  removeFromCollection: (book: Book) => Promise<string | null>;
  toggleCollection: (book: Book) => Promise<string | null>;
  reloadActive: () => Promise<void>;
  reset: () => void;
  findBook: (id: string) => Book | undefined;
};

const BooksContext = createContext<BooksContextValue | null>(null);

export function BooksProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [upcoming, setUpcoming] = useState<Book[]>([]);
  const [library, setLibrary] = useState<Book[]>([]);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const pendingSaves = useRef(new Set<string>());
  const collectionGeneration = useRef(0);
  const collectionEdits = useRef(new Map<string, Book | null>());
  const [loading, setLoading] = useState(false);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionLoaded, setCollectionLoaded] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState("");
  const [activeLanguage, setActiveLanguage] = useState("all");

  const loadingRef = useRef(false);
  const collectionLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const defaultFeedLoadedRef = useRef(false);
  const activeQueryRef = useRef("");
  const activeLanguageRef = useRef("all");
  const booksRef = useRef<Book[]>([]);
  const upcomingRef = useRef<Book[]>([]);
  const libraryRef = useRef<Book[]>([]);

  const loadBooks = useCallback(async (options: LoadBooksOptions = {}) => {
    if (loadingRef.current) return [];
    const query = options.query ?? "";
    const language = options.language ?? "all";
    const isDefaultFeed = !query && (language === "all" || !language);

    if (
      hasLoadedRef.current &&
      isDefaultFeed &&
      defaultFeedLoadedRef.current &&
      !options.forceRefresh
    ) {
      return [...booksRef.current, ...upcomingRef.current];
    }

    if (!isDefaultFeed) defaultFeedLoadedRef.current = false;

    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [liveFeed, comingFeed] = await Promise.all([
        fetchBooks({ query: query || undefined }),
        fetchUpcomingBooks(),
      ]);
      const live = liveFeed;
      const coming = comingFeed;
      if (__DEV__) {
        console.log(
          `[books] language=${language} live=${live.length} upcoming=${coming.length}`,
        );
      }
      booksRef.current = live;
      upcomingRef.current = coming;
      setBooks(live);
      setUpcoming(coming);
      activeQueryRef.current = query;
      activeLanguageRef.current = language;
      setActiveQuery(query);
      setActiveLanguage(language);
      defaultFeedLoadedRef.current = isDefaultFeed;
      return [...live, ...coming];
    } catch (exception) {
      setError(apiErrorMessage(exception));
      defaultFeedLoadedRef.current = false;
      return [];
    } finally {
      hasLoadedRef.current = true;
      setHasLoaded(true);
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const loadCollection = useCallback(
    async (forceRefresh = false) => {
      if (collectionLoadingRef.current) return;
      if (collectionLoaded && !forceRefresh) return;
      collectionLoadingRef.current = true;
      const generation = collectionGeneration.current;
      collectionEdits.current.clear();
      setCollectionLoading(true);
      try {
        let collection = await fetchCollection();
        if (generation !== collectionGeneration.current) return;
        // A library fetch may have started before a save/remove finished.
        for (const [id, edit] of collectionEdits.current) {
          collection = collection.filter((item) => item.id !== id);
          if (edit) collection.push(edit);
        }
        libraryRef.current = collection;
        setLibrary(collection);
        setCollectionError(null);
      } catch (exception) {
        if (generation === collectionGeneration.current) setCollectionError(apiErrorMessage(exception));
      } finally {
        if (generation === collectionGeneration.current) {
          collectionEdits.current.clear();
          collectionLoadingRef.current = false;
          setCollectionLoading(false);
          setCollectionLoaded(true);
        }
      }
    },
    [collectionLoaded],
  );

  const updateCollection = useCallback(async (book: Book, save: boolean) => {
    if (pendingSaves.current.has(book.id)) return 'Working…';
    pendingSaves.current.add(book.id);
    setSavingIds([...pendingSaves.current]);
    const generation = collectionGeneration.current;
    try {
      await request(collectionItemPath(book), { method: save ? 'POST' : 'DELETE' });
      if (generation !== collectionGeneration.current) return null;
      if (collectionLoadingRef.current) collectionEdits.current.set(book.id, save ? book : null);
      const next = !save ? libraryRef.current.filter((item) => item.id !== book.id)
        : libraryRef.current.some((item) => item.id === book.id)
        ? libraryRef.current
        : [...libraryRef.current, book];
      libraryRef.current = next;
      setLibrary(next);
      return null;
    } catch (exception) {
      return apiErrorMessage(exception);
    } finally {
      if (generation === collectionGeneration.current) {
        pendingSaves.current.delete(book.id);
        setSavingIds([...pendingSaves.current]);
      }
    }
  }, []);

  const addToCollection = useCallback((book: Book) => updateCollection(book, true), [updateCollection]);
  const removeFromCollection = useCallback((book: Book) => updateCollection(book, false), [updateCollection]);

  const toggleCollection = useCallback(
    async (book: Book) => {
      const saved = libraryRef.current.some((item) => item.id === book.id);
      return saved ? removeFromCollection(book) : addToCollection(book);
    },
    [addToCollection, removeFromCollection],
  );

  const reloadActive = useCallback(async () => {
    await loadBooks({
      query: activeQueryRef.current || undefined,
      language: activeLanguageRef.current,
      forceRefresh: true,
    });
  }, [loadBooks]);

  const reset = useCallback(() => {
    collectionGeneration.current++;
    pendingSaves.current.clear();
    collectionEdits.current.clear();
    setSavingIds([]);
    setBooks([]);
    setUpcoming([]);
    setLibrary([]);
    setLoading(false);
    setCollectionLoading(false);
    setCollectionLoaded(false);
    setCollectionError(null);
    setHasLoaded(false);
    setError(null);
    setActiveQuery("");
    setActiveLanguage("all");
    loadingRef.current = false;
    collectionLoadingRef.current = false;
    hasLoadedRef.current = false;
    defaultFeedLoadedRef.current = false;
    activeQueryRef.current = "";
    activeLanguageRef.current = "all";
    booksRef.current = [];
    upcomingRef.current = [];
    libraryRef.current = [];
  }, []);

  const findBook = useCallback(
    (id: string) =>
      books.find((item) => item.id === id) ??
      upcoming.find((item) => item.id === id) ??
      library.find((item) => item.id === id),
    [books, upcoming, library],
  );
  const resolveBook = useCallback(
    async (id: string): Promise<Book | null> => {
      if (!id) return null;
      const cached =
        booksRef.current.find((item) => item.id === id) ??
        upcomingRef.current.find((item) => item.id === id) ??
        libraryRef.current.find((item) => item.id === id);
      if (cached) return cached;
      const fresh = await loadBooks({ forceRefresh: true });
      return (
        fresh.find((item) => item.id === id) ??
        libraryRef.current.find((item) => item.id === id) ??
        null
      );
    },
    [loadBooks],
  );

  const value = useMemo(
    () => ({
      books,
      upcoming,
      library,
      savingIds,
      loading,
      collectionLoading,
      collectionLoaded,
      collectionError,
      hasLoaded,
      error,
      activeQuery,
      activeLanguage,
      loadBooks,
      loadCollection,
      resolveBook,
      addToCollection,
      removeFromCollection,
      toggleCollection,
      reloadActive,
      reset,
      findBook,
    }),
    [
      books,
      upcoming,
      library,
      savingIds,
      loading,
      collectionLoading,
      collectionLoaded,
      collectionError,
      hasLoaded,
      error,
      activeQuery,
      activeLanguage,
      loadBooks,
      loadCollection,
      resolveBook,
      addToCollection,
      removeFromCollection,
      toggleCollection,
      reloadActive,
      reset,
      findBook,
    ],
  );

  return (
    <BooksContext.Provider value={value}>{children}</BooksContext.Provider>
  );
}

export function useBooks() {
  const value = useContext(BooksContext);
  if (!value) throw new Error("BooksProvider is missing.");
  return value;
}
