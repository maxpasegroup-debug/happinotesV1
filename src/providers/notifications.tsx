import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiErrorMessage, parseNotification, request } from "@/lib/api";
import type { AppNotification } from "@/lib/types";

type NotificationsContextValue = {
  items: AppNotification[];
  loading: boolean;
  error: string | null;
  load: (forceRefresh?: boolean) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (loadingRef.current) return;
    if (loadedRef.current && !forceRefresh) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await request<{ notifications: any[] }>("/notifications", { cache: 'no-store' });
      setItems(
        Array.isArray(result.notifications)
          ? result.notifications.map(parseNotification)
          : [],
      );
      loadedRef.current = true;
    } catch (exception) {
      setError(apiErrorMessage(exception));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ items, loading, error, load }),
    [items, loading, error, load],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("NotificationsProvider is missing.");
  return value;
}
