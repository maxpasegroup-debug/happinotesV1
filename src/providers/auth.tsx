import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearToken,
  parseDeletionProof,
  parseDeletionStatus,
  parseUser,
  readToken,
  request,
  saveToken,
  apiErrorMessage,
} from "@/lib/api";
import type {
  AccountDeletionRequestStatus,
  DeletionReauthProof,
  User,
} from "@/lib/types";

type SubscriptionPatch = {
  active: boolean;
  plan?: string;
  productId?: string;
  expiresAt?: string;
  autoRenewing?: boolean;
};

type AuthContextValue = {
  user: User | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  requestEmailOtp: (email: string) => Promise<number>;
  verifyEmailOtp: (email: string, otp: string) => Promise<string>;
  signup: (
    name: string,
    email: string,
    password: string,
    challenge: string,
  ) => Promise<void>;
  updateLanguage: (value: string) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
  requestDeletionReauth: (credential: string) => Promise<DeletionReauthProof>;
  requestAccountDeletion: (
    proof: string,
    idempotencyKey: string,
  ) => Promise<AccountDeletionRequestStatus>;
  getAccountDeletionStatus: () => Promise<AccountDeletionRequestStatus>;
  updateSubscription: (patch: SubscriptionPatch) => void;
  updatePurchasedBooks: (ids: string[]) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      const token = await readToken();
      if (!token) return;
      try {
        const raw = await request<any>("/auth/me");
        const json = raw?.user;
        if (!json || typeof json !== "object") {
          throw new Error("The saved session could not be read.");
        }
        const parsed = parseUser(json);
        if (!parsed.id) throw new Error("The saved session is invalid.");
       if (mounted) setUser(parsed);
      } catch {
        // Flutter clears the stored token whenever restoreSession throws.
        await clearToken().catch(() => {});
        if (mounted) setUser(null);
      }
    };

    void (async () => {
      await Promise.all([
        // Keep startup bounded when the saved token points at an unavailable
        // backend, but never wipe the token on a timeout: the next
        // authenticated request can retry.
        Promise.race([
          restore().catch(() => {}),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]),
        // Keep the branded splash visible briefly so the native launch
        // window hands off smoothly.
        new Promise<void>((resolve) => setTimeout(resolve, 1200)),
      ]);
      if (mounted) setInitialized(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await request<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    await saveToken(String(result.token));
    setUser(parseUser(result.user));
  }, []);

  const requestEmailOtp = useCallback(async (email: string) => {
    const result = await request<any>("/auth/request-email-otp", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        purpose: "signup",
      }),
    });
    const parsed = Number(result?.resendAfterSeconds);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60;
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, otp: string) => {
    const result = await request<any>("/auth/verify-email-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp, purpose: "signup" }),
    });
    return String(result.emailChallenge ?? "");
  }, []);

  const signup = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      challenge: string,
    ) => {
      const result = await request<any>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email,
          password,
          emailChallenge: challenge,
        }),
      });
      await saveToken(String(result.token));
      setUser(parseUser(result.user));
    },
    [],
  );

  const updateLanguage = useCallback(async (value: string) => {
    const result = await request<any>("/auth/me", {
      method: "PUT",
      body: JSON.stringify({ languagePreference: value }),
    });
    if (result?.user) setUser(parseUser(result.user));
  }, []);

  const refreshUser = useCallback(async () => {
    const result = await request<any>("/auth/me");
    const refreshed = parseUser(result?.user);
    setUser((current) =>
      current && refreshed.id === current.id ? refreshed : current,
    );
    return refreshed;
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const requestDeletionReauth = useCallback(async (credential: string) => {
    const result = await request<any>("/auth/me/deletion-re-auth", {
      method: "POST",
      body: JSON.stringify({ password: credential }),
    });
    return parseDeletionProof(result);
  }, []);

  const requestAccountDeletion = useCallback(
    async (proof: string, idempotencyKey: string) => {
      const result = await request<any>("/auth/me/deletion-request", {
        method: "POST",
        body: JSON.stringify({ proof, idempotencyKey }),
      });
      return parseDeletionStatus(result);
    },
    [],
  );

  const getAccountDeletionStatus = useCallback(async () => {
    const result = await request<any>("/auth/me/deletion-request");
    return parseDeletionStatus(result);
  }, []);

  const updateSubscription = useCallback((patch: SubscriptionPatch) => {
    setUser((current) => {
      if (!current) return current;
      return {
        ...current,
        subscriptionActive: patch.active,
        subscriptionPlan: patch.active ? patch.plan : undefined,
        subscriptionProductId: patch.active ? patch.productId : undefined,
        subscriptionExpiresAt: patch.active ? patch.expiresAt : undefined,
        subscriptionAutoRenewing: patch.active ? patch.autoRenewing : undefined,
      };
    });
  }, []);

  const updatePurchasedBooks = useCallback((ids: string[]) => {
    setUser((current) =>
      current ? { ...current, purchasedBookIds: ids } : current,
    );
  }, []);

  const value = useMemo(
    () => ({
      user,
      initialized,
      login,
      requestEmailOtp,
      verifyEmailOtp,
      signup,
      updateLanguage,
      refreshUser,
      logout,
      requestDeletionReauth,
      requestAccountDeletion,
      getAccountDeletionStatus,
      updateSubscription,
      updatePurchasedBooks,
    }),
    [
      user,
      initialized,
      login,
      requestEmailOtp,
      verifyEmailOtp,
      signup,
      updateLanguage,
      refreshUser,
      logout,
      requestDeletionReauth,
      requestAccountDeletion,
      getAccountDeletionStatus,
      updateSubscription,
      updatePurchasedBooks,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing.");
  return value;
}

export { apiErrorMessage };
