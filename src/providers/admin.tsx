import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import * as DocumentPicker from "expo-document-picker";
import { apiErrorMessage, request } from "@/lib/api";
import type {
  AdminBook,
  AdminStats,
  AdminUser,
  BookDraft,
  BookDraftEpisode,
} from "@/lib/types";

export function emptyDraft(): BookDraft {
  return {
    title: "",
    description: "",
    language: "english",
    category: "happiness",
    status: "draft",
    accessType: "free",
    priceInr: "0",
    coverImageUrl: "",
    coverPublicId: "",
    introAudioUrl: "",
    introAudioPublicId: "",
    audioFileName: "",
    duration: "0",
    sortOrder: "0",
    tags: "",
    featured: false,
    trending: false,
    episodes: [],
  };
}

function draftFromJson(json: AdminBook): BookDraft {
  const introAudioUrl = String(json.introAudioUrl ?? "");
  const audioFileName = String(json.introAudioFileName ?? "");
  const episodes: BookDraftEpisode[] = Array.isArray(json.lessons)
    ? json.lessons
        .filter((lesson: any) => lesson && typeof lesson === "object")
        .map((lesson: any) => ({
          title: String(lesson.title ?? "Episode"),
          description: String(lesson.description ?? ""),
          mediaUrl: String(lesson.mediaUrl ?? ""),
          mediaType: String(lesson.mediaType ?? "audio"),
          order: Number(lesson.order ?? 0),
          fileName:
            lesson.fileName != null ? String(lesson.fileName) : undefined,
        }))
    : [];
  if (episodes.length === 0 && introAudioUrl) {
    episodes.push({
      title: "Episode 1",
      description: "",
      mediaUrl: introAudioUrl,
      mediaType: "audio",
      order: 0,
      fileName: audioFileName,
    });
  }
  return {
    id: json._id != null ? String(json._id) : undefined,
    title: String(json.title ?? ""),
    description: String(json.description ?? ""),
    language: String(json.language ?? "english"),
    category: String(json.category ?? "happiness"),
    status: String(json.status ?? "draft"),
    accessType: String(json.accessType ?? "free"),
    priceInr: String(json.priceInr ?? 0),
    coverImageUrl: String(json.coverImageUrl ?? json.thumbnailUrl ?? ""),
    coverPublicId: String(json.coverPublicId ?? ""),
    introAudioUrl,
    introAudioPublicId: String(json.introAudioPublicId ?? ""),
    audioFileName,
    duration: String(json.totalDurationSeconds ?? 0),
    sortOrder: String(json.sortOrder ?? 0),
    tags: Array.isArray(json.tags) ? json.tags.join(", ") : "",
    featured: json.isFeatured === true,
    trending: json.isTrending === true,
    episodes,
  };
}

function draftToJson(draft: BookDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    language: draft.language,
    category: draft.category,
    status: draft.status,
    accessType: draft.accessType,
    type: draft.accessType,
    priceInr: 0,
    coverImageUrl: draft.coverImageUrl,
    thumbnailUrl: draft.coverImageUrl,
    coverPublicId: draft.coverPublicId,
    introAudioUrl: draft.introAudioUrl,
    introAudioPublicId: draft.introAudioPublicId,
    introAudioFileName: draft.audioFileName,
    totalDurationSeconds: Number.parseInt(draft.duration, 10) || 0,
    sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
    tags: draft.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    isFeatured: draft.featured,
    isTrending: draft.trending,
    lessons: draft.episodes.map((episode, index) => ({
      ...episode,
      order: index,
    })),
  };
}

export type AdminResult = {
  ok: boolean;
  error: string | null;
  success?: string | null;
};

type AdminContextValue = {
  stats: AdminStats;
  books: AdminBook[];
  users: AdminUser[];
  tab: number;
  loading: boolean;
  busy: boolean;
  error: string | null;
  success: string | null;
  draft: BookDraft;
  notificationImageUrl: string;
  setTab: (value: number) => void;
  loadAll: () => Promise<void>;
  newBook: () => void;
  editBook: (book: AdminBook) => void;
  updateDraft: (patch: Partial<BookDraft>) => void;
  updateEpisode: (
    index: number,
    key: keyof BookDraftEpisode,
    value: string,
  ) => void;
  removeEpisode: (index: number) => void;
  addEpisode: (episode: BookDraftEpisode) => void;
  uploadCover: () => Promise<AdminResult>;
  uploadEpisode: () => Promise<AdminResult>;
  uploadNotificationImage: () => Promise<AdminResult>;
  saveBook: () => Promise<AdminResult>;
  removeBook: (id: string) => Promise<AdminResult>;
  notifyUsers: (
    title: string,
    message: string,
    target: string,
  ) => Promise<AdminResult>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<AdminStats>({});
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tab, setTabState] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookDraft>(emptyDraft());
  const [notificationImageUrl, setNotificationImageUrl] = useState("");

  const setTab = useCallback((value: number) => setTabState(value), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, booksResult, usersResult] = await Promise.all([
        request<any>("/admin/stats"),
        request<any>("/admin/books"),
        request<any>("/admin/users"),
      ]);
      setStats(statsResult?.stats ?? {});
      setBooks(Array.isArray(booksResult?.books) ? booksResult.books : []);
      setUsers(Array.isArray(usersResult?.users) ? usersResult.users : []);
    } catch (exception) {
      setError(apiErrorMessage(exception));
    } finally {
      setLoading(false);
    }
  }, []);

  const newBook = useCallback(() => {
    setDraft(emptyDraft());
    setError(null);
  }, []);

  const editBook = useCallback((book: AdminBook) => {
    setDraft(draftFromJson(book));
    setError(null);
  }, []);

  const updateDraft = useCallback((patch: Partial<BookDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const updateEpisode = useCallback(
    (index: number, key: keyof BookDraftEpisode, value: string) => {
      setDraft((current) => ({
        ...current,
        episodes: current.episodes.map((episode, position) =>
          position === index ? { ...episode, [key]: value } : episode,
        ),
      }));
    },
    [],
  );

  const removeEpisode = useCallback((index: number) => {
    setDraft((current) => ({
      ...current,
      episodes: current.episodes
        .filter((_, position) => position !== index)
        .map((episode, position) => ({ ...episode, order: position })),
    }));
  }, []);

  const addEpisode = useCallback((episode: BookDraftEpisode) => {
    setDraft((current) => ({
      ...current,
      episodes: [...current.episodes, episode],
    }));
  }, []);

  const uploadMedia = useCallback(
    async (kind: "cover" | "notification" | "audio"): Promise<AdminResult> => {
      const isImage = kind !== "audio";
      const picked = await DocumentPicker.getDocumentAsync({
        type: isImage
          ? ["image/jpeg", "image/png", "image/webp"]
          : ["audio/mpeg", "audio/mp3"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.length) {
        return { ok: false, error: null };
      }
      const file = picked.assets[0];
      const maxBytes = kind === "cover" ? 5 * 1024 * 1024 : 200 * 1024 * 1024;
      if (typeof file.size === "number" && file.size > maxBytes) {
        const tooLarge =
          kind === "cover"
            ? "Cover image must be 5 MB or smaller."
            : "MP3 must be 200 MB or smaller.";
        setError(tooLarge);
        return { ok: false, error: tooLarge };
      }
      setBusy(true);
      setError(null);
      try {
        const form = new FormData();
        form.append(
          "scope",
          kind === "cover"
            ? "cover"
            : kind === "notification"
              ? "notification"
              : "lesson",
        );
        form.append("media", {
          uri: file.uri,
          name: file.name,
          type:
            file.mimeType ?? (kind === "audio" ? "audio/mpeg" : "image/jpeg"),
        } as any);
        const result = await request<{ url: string }>(
          "/admin/contents/upload-media",
          { method: "POST", body: form },
        );
        const url = String(result.url ?? "");
        if (kind === "cover") {
          setDraft((current) => ({ ...current, coverImageUrl: url }));
          setSuccess("Cover uploaded");
        } else if (kind === "notification") {
          setNotificationImageUrl(url);
          setSuccess("Notification image uploaded");
        } else {
          setDraft((current) => ({
            ...current,
            introAudioUrl: url,
            audioFileName: file.name,
            episodes:
              current.episodes.length === 0
                ? [
                    {
                      title: "Episode 1",
                      description: "",
                      mediaUrl: url,
                      mediaType: "audio",
                      order: 0,
                      fileName: file.name,
                    },
                  ]
                : current.episodes.map((episode, index) =>
                    index === 0
                      ? {
                          ...episode,
                          mediaUrl: url,
                          fileName: file.name,
                          mediaType: "audio",
                        }
                      : episode,
                  ),
          }));
          setSuccess("MP3 uploaded");
        }
        return { ok: Boolean(url), error: url ? null : "Upload failed" };
      } catch (exception) {
        const message = apiErrorMessage(exception);
        setError(message);
        return { ok: false, error: message };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const uploadCover = useCallback(() => uploadMedia("cover"), [uploadMedia]);

  const uploadEpisode = useCallback(async (): Promise<AdminResult> => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["audio/mpeg", "audio/mp3"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.length) {
      return { ok: false, error: null };
    }
    const file = picked.assets[0];
    if (typeof file.size === "number" && file.size > 200 * 1024 * 1024) {
      const tooLarge = "MP3 must be 200 MB or smaller.";
      setError(tooLarge);
      return { ok: false, error: tooLarge };
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("scope", "lesson");
      form.append("media", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? "audio/mpeg",
      } as any);
      const result = await request<{ url: string }>(
        "/admin/contents/upload-media",
        { method: "POST", body: form },
      );
      const url = String(result.url ?? "");
      setDraft((current) => ({
        ...current,
        episodes: [
          ...current.episodes,
          {
            title: `Episode ${current.episodes.length + 1}`,
            description: "",
            mediaUrl: url,
            mediaType: "audio",
            order: current.episodes.length,
            fileName: file.name,
          },
        ],
      }));
      setSuccess("Episode uploaded");
      return { ok: Boolean(url), error: url ? null : "Upload failed" };
    } catch (exception) {
      const message = apiErrorMessage(exception);
      setError(message);
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }, []);

  const uploadNotificationImage = useCallback(
    () => uploadMedia("notification"),
    [uploadMedia],
  );

  const saveBook = useCallback(async (): Promise<AdminResult> => {
    if (!draft.title.trim() || !draft.description.trim()) {
      const missing = "Title and description are required.";
      setError(missing);
      return { ok: false, error: missing };
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const body = JSON.stringify(draftToJson(draft));
      let saved = "";
      if (draft.id) {
        await request(`/admin/books/${draft.id}`, { method: "PUT", body });
        saved = "Book updated";
      } else {
        await request("/admin/books", { method: "POST", body });
        saved = "Book created";
      }
      setSuccess(saved);
      await loadAll();
      return { ok: true, error: null, success: saved };
    } catch (exception) {
      const message = apiErrorMessage(exception);
      setError(message);
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }, [draft, loadAll]);

  const removeBook = useCallback(
    async (id: string): Promise<AdminResult> => {
      setBusy(true);
      setError(null);
      try {
        await request(`/admin/books/${id}`, { method: "DELETE" });
        setSuccess("Book deleted");
        await loadAll();
        return { ok: true, error: null, success: "Book deleted" };
      } catch (exception) {
        const message = apiErrorMessage(exception);
        setError(message);
        return { ok: false, error: message };
      } finally {
        setBusy(false);
      }
    },
    [loadAll],
  );

  const notifyUsers = useCallback(
    async (
      title: string,
      message: string,
      target: string,
    ): Promise<AdminResult> => {
      if (!title.trim() || !message.trim()) {
        const missing = "Enter a title and message.";
        setError(missing);
        return { ok: false, error: missing };
      }
      setBusy(true);
      setError(null);
      try {
        await request("/admin/notify", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            message: message.trim(),
            target,
            ...(notificationImageUrl ? { imageUrl: notificationImageUrl } : {}),
          }),
        });
        setSuccess("Notification sent");
        return { ok: true, error: null, success: "Notification sent" };
      } catch (exception) {
        const failure = apiErrorMessage(exception);
        setError(failure);
        return { ok: false, error: failure };
      } finally {
        setBusy(false);
      }
    },
    [notificationImageUrl],
  );

  const value = useMemo(
    () => ({
      stats,
      books,
      users,
      tab,
      loading,
      busy,
      error,
      success,
      draft,
      notificationImageUrl,
      setTab,
      loadAll,
      newBook,
      editBook,
      updateDraft,
      updateEpisode,
      removeEpisode,
      addEpisode,
      uploadCover,
      uploadEpisode,
      uploadNotificationImage,
      saveBook,
      removeBook,
      notifyUsers,
    }),
    [
      stats,
      books,
      users,
      tab,
      loading,
      busy,
      error,
      success,
      draft,
      notificationImageUrl,
      setTab,
      loadAll,
      newBook,
      editBook,
      updateDraft,
      updateEpisode,
      removeEpisode,
      addEpisode,
      uploadCover,
      uploadEpisode,
      uploadNotificationImage,
      saveBook,
      removeBook,
      notifyUsers,
    ],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error("AdminProvider is missing.");
  return value;
}
