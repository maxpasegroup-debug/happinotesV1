import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { happyBiteAsBook, parseHappyBite } from './happy-bite-access';
import type {
  AccountDeletionRequestStatus,
  AppNotification,
  Book,
  DeletionReauthProof,
  User,
} from "./types";

const RAW_API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);

const USES_METRO_PROXY = Platform.OS === "web" && __DEV__ && RAW_API_BASE_URL !== "";

export const API_BASE_URL = USES_METRO_PROXY
  ? "/__proxy-api"
  : RAW_API_BASE_URL;
export const API_ORIGIN = USES_METRO_PROXY
  ? typeof window !== "undefined"
    ? window.location.origin
    : ""
  : RAW_API_BASE_URL.replace(/\/api\/?$/, "");

export const API_SOCKET_PATH = USES_METRO_PROXY
  ? "/__proxy-socket.io"
  : "/socket.io";

export const API_HOST = (() => {
  try {
    return new URL(RAW_API_BASE_URL || "http://localhost").host;
  } catch {
    return RAW_API_BASE_URL;
  }
})();

const TOKEN_KEY = "jwt_token";
const isWeb = Platform.OS === "web";

async function storeGet(key: string) {
  try {
    if (isWeb && typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function storeSet(key: string, value: string) {
  try {
    if (isWeb && typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
  }
}

async function storeDelete(key: string) {
  try {
    if (isWeb && typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
  }
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const WAKE_UP_STATUS_CODES = [502, 503, 504];
const WAKE_UP_DELAYS = [700, 1600];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readToken() {
  return storeGet(TOKEN_KEY);
}

export async function saveToken(token: string) {
  await storeSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storeDelete(TOKEN_KEY);
}
export async function readPreference(key: string) {
  return storeGet(`preference-${key}`);
}

export async function savePreference(key: string, value: string) {
  await storeSet(`preference-${key}`, value);
}

export async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!RAW_API_BASE_URL) {
    throw new ApiError(
      "The API URL is missing from this build. Restart Metro with `npx expo start -c` so EXPO_PUBLIC_API_BASE_URL is picked up.",
    );
  }
  const token = await readToken();
  const isForm =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isForm || options.body == null
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };
  const canRetry = options.body == null;
  const maxAttempts = WAKE_UP_DELAYS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (error: any) {
      if (__DEV__) {
        console.warn(`[api] ${options.method ?? "GET"} ${path} failed`, error);
      }
      const timedOut = error?.name === "AbortError";
      if (!timedOut && canRetry && attempt < maxAttempts - 1) {
        await wait(WAKE_UP_DELAYS[attempt]);
        continue;
      }
      if (timedOut) {
        throw new ApiError(`The request to ${API_HOST} timed out.`);
      }
      throw new ApiError(
        Platform.OS === "web"
          ? `The browser blocked the request to ${API_HOST}. Add this page's origin to the API's CORS_ORIGINS, or run the app on Android/iOS.`
          : `Cannot reach ${API_HOST}. The Railway service may be waking up, or the device has no internet connection.`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (
      canRetry &&
      attempt < maxAttempts - 1 &&
      WAKE_UP_STATUS_CODES.includes(response.status)
    ) {
      await wait(WAKE_UP_DELAYS[attempt]);
      continue;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        data?.message ?? data?.error ?? `Request failed (${response.status})`,
        response.status,
      );
    }
    return data as T;
  }

  throw new ApiError(`Cannot reach ${API_HOST}.`);
}

export function apiErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Network request failed";
}

export function parseBook(json: any): Book {
  const lessons: any[] = Array.isArray(json?.lessons) ? json.lessons : [];
  const episodes = lessons
    .filter((lesson) => lesson && typeof lesson === "object")
    .map((lesson) => ({
      title: String(lesson.title ?? "Episode"),
      description: String(lesson.description ?? ""),
      audioUrl: String(lesson.mediaUrl ?? ""),
      order: Number(lesson.order ?? 0),
    }));
  const introAudioUrl = String(json?.introAudioUrl ?? "");
  if (lessons.length === 0 && introAudioUrl) {
    episodes.unshift({
      title: "Episode 1",
      description: "",
      audioUrl: introAudioUrl,
      order: 0,
    });
  }
  return {
    id: String(json?._id ?? json?.id ?? ""),
    title: String(json?.title ?? ""),
    description: String(json?.description ?? ""),
    language: String(json?.language ?? ""),
    category: String(json?.category ?? ""),
    coverImageUrl: String(json?.coverImageUrl ?? json?.thumbnailUrl ?? ""),
    audioUrl: introAudioUrl,
    accessType: String(json?.accessType ?? json?.type ?? "free"),
    priceInr: Number(json?.priceInr ?? 0),
    status: String(json?.status ?? "live"),
    duration: Number(json?.totalDurationSeconds ?? 0),
    createdAt: json?.createdAt ? String(json.createdAt) : undefined,
    episodes,
  };
}

export function parseUser(json: any): User {
  const subscription =
    json?.subscription && typeof json.subscription === "object"
      ? json.subscription
      : {};
  const rawExpiry = json?.subscriptionExpiresAt ?? subscription.expiresAt;
  return {
    id: String(json?.id ?? json?._id ?? ""),
    name: String(json?.name ?? ""),
    role: String(json?.role ?? "user"),
    email: json?.email != null ? String(json.email) : undefined,
    phoneNumber:
      json?.phoneNumber != null ? String(json.phoneNumber) : undefined,
    languagePreference: String(json?.languagePreference ?? "all"),
    purchasedBookIds: Array.isArray(json?.purchasedBookIds)
      ? json.purchasedBookIds.map((id: any) => String(id))
      : [],
    subscriptionActive:
      json?.subscriptionActive === true || subscription.active === true,
    subscriptionPlan:
      json?.subscriptionPlan != null
        ? String(json.subscriptionPlan)
        : subscription.planKey != null
          ? String(subscription.planKey)
          : undefined,
    subscriptionProductId:
      json?.subscriptionProductId != null
        ? String(json.subscriptionProductId)
        : subscription.productId != null
          ? String(subscription.productId)
          : undefined,
    subscriptionExpiresAt: rawExpiry != null ? String(rawExpiry) : undefined,
    subscriptionAutoRenewing:
      typeof json?.subscriptionAutoRenewing === "boolean"
        ? json.subscriptionAutoRenewing
        : typeof subscription.autoRenewing === "boolean"
          ? subscription.autoRenewing
          : undefined,
  };
}

export function parseNotification(json: any): AppNotification {
  return {
    id: String(json?.id ?? json?._id ?? ""),
    title: String(json?.title ?? ""),
    message: String(json?.message ?? ""),
    type: String(json?.type ?? "admin"),
    target: String(json?.target ?? "all"),
    createdAt: String(json?.createdAt ?? new Date().toISOString()),
    bookId: json?.bookId != null ? String(json.bookId) : undefined,
    episodeId: json?.episodeId != null ? String(json.episodeId) : undefined,
    imageUrl: json?.imageUrl != null ? String(json.imageUrl) : undefined,
  };
}

export function parseDeletionStatus(json: any): AccountDeletionRequestStatus {
  const known = [
    "requested",
    "processing",
    "failed_retryable",
    "failed_manual",
    "blocked_policy",
    "completed",
  ];
  const status = known.includes(String(json?.status))
    ? (String(json.status) as AccountDeletionRequestStatus["status"])
    : "unknown";
  return {
    requestId: String(json?.requestId ?? ""),
    status,
    reference: json?.reference != null ? String(json.reference) : undefined,
    requestedAt:
      json?.requestedAt != null ? String(json.requestedAt) : undefined,
    startedAt: json?.startedAt != null ? String(json.startedAt) : undefined,
    completedAt:
      json?.completedAt != null ? String(json.completedAt) : undefined,
    failureCode:
      json?.failureCode != null ? String(json.failureCode) : undefined,
    statusToken:
      json?.statusToken != null ? String(json.statusToken) : undefined,
  };
}

export function parseDeletionProof(json: any): DeletionReauthProof {
  return {
    proof: String(json?.proof ?? ""),
    expiresAt: json?.expiresAt != null ? String(json.expiresAt) : undefined,
  };
}

/**
 * The catalogue is deliberately requested without a `language` filter: the API
 * lower-cases the query value but matches it exactly against the stored field
 * (`"English"`), so `language=english` and `language=English` both answer 0
 * rows. The provider filters the returned list case-insensitively instead,
 * which is also what Flutter's Home tab does locally.
 */
export async function fetchBooks(options: { query?: string }) {
  const params = new URLSearchParams();
  params.set("type", "lifebook");
  params.set("status", "live");
  if (options.query) params.set("query", options.query);
  const result = await request<{ contents: any[] }>(
    `/contents?${params.toString()}`,
  );
  return (result.contents ?? []).map(parseBook);
}

export async function fetchUpcomingBooks() {
  const params = new URLSearchParams();
  params.set("type", "lifebook");
  params.set("status", "coming_soon");
  const result = await request<{ contents: any[] }>(
    `/contents?${params.toString()}`,
  );
  return (result.contents ?? []).map(parseBook);
}

export async function fetchCollection() {
  const result = await request<{ collection?: any[]; happyBites?: any[] }>("/collection", { cache: 'no-store' });
  return [
    ...(result.collection ?? []).map(parseBook),
    ...(result.happyBites ?? []).map((bite) => happyBiteAsBook(parseHappyBite(bite))),
  ];
}

export function collectionItemPath(book: Pick<Book, 'id' | 'happyBiteId'>) {
  return book.happyBiteId
    ? `/collection/happy-bites/${encodeURIComponent(book.happyBiteId)}`
    : `/collection/${encodeURIComponent(book.id)}`;
}
