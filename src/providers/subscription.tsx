import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Linking, Platform } from "react-native";
import { useIAP, IAP_SUPPORTED } from "@/lib/iap";
import { IS_EXPO_GO } from "@/lib/app-environment";
import { apiErrorMessage, request } from "@/lib/api";
import { useAuth } from "@/providers/auth";
import { useBooks } from "@/providers/books";
import type { SubscriptionPlan } from "@/lib/types";

type SubscriptionContextValue = {
  plans: SubscriptionPlan[];
  plan: SubscriptionPlan | null;
  price: string | null;
  activePrice: string | null;
  loading: boolean;
  busy: boolean;
  connected: boolean;
  message: string | null;
  buy: () => Promise<void>;
  restore: () => Promise<void>;
  reload: () => Promise<void>;
  openStoreSubscriptions: () => Promise<void>;
  setMessage: (value: string | null) => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null,
);

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, updateSubscription } = useAuth();
  const { loadBooks } = useBooks();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [accountToken, setAccountToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const restoringRef = useRef(false);
  const handledRef = useRef(new Set<string>());
  const retryRef = useRef(new Map<string, any>());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = useRef<any>(null);

  const verify = useCallback(
    async (purchase: any, restore: boolean) => {
      if (purchase?.purchaseState && purchase.purchaseState !== "purchased") {
        setMessage("Subscription payment is pending.");
        return;
      }
      const productId = String(purchase?.productId ?? "");
      const transactionId = String(
        purchase?.transactionId ?? purchase?.id ?? "",
      );
      const verificationData =
        Platform.OS === "android" ? String(purchase?.purchaseToken ?? "") : "";
      if (!productId || !transactionId) {
        throw new Error("The store returned an incomplete transaction.");
      }
      const key = `${productId}:${transactionId}`;
      if (handledRef.current.has(key)) return;
      setBusy(true);
      try {
        const result = await request<any>(
          "/payments/store/subscription-verify",
          {
            method: "POST",
            body: JSON.stringify({
              store: Platform.OS === "ios" ? "ios" : "android",
              productId,
              transactionId,
              verificationData,
              restore,
            }),
          },
        );
        await finishRef.current?.({ purchase, isConsumable: false });
        handledRef.current.add(key);
        retryRef.current.delete(key);
        const active = result?.subscriptionActive === true;
        updateSubscription({
          active,
          plan:
            result?.subscriptionPlan != null
              ? String(result.subscriptionPlan)
              : undefined,
          productId:
            result?.subscriptionProductId != null
              ? String(result.subscriptionProductId)
              : productId,
          expiresAt:
            result?.subscriptionExpiresAt != null
              ? String(result.subscriptionExpiresAt)
              : undefined,
          autoRenewing:
            typeof result?.subscriptionAutoRenewing === "boolean"
              ? result.subscriptionAutoRenewing
              : undefined,
        });
        await loadBooks({ forceRefresh: true }).catch(() => {
        });
        setMessage(
          active ? "Subscription activated." : "Subscription is not active.",
        );
      } catch (exception) {
        retryRef.current.set(key, purchase);
        throw exception;
      } finally {
        setBusy(false);
      }
    },
    [loadBooks, updateSubscription],
  );

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    restorePurchases,
    availablePurchases,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void verify(purchase, restoringRef.current).catch((error) =>
        setMessage(apiErrorMessage(error)),
      );
    },
    onPurchaseError: (error) => {
      if (error?.code === "user-cancelled") {
        setMessage("Subscription cancelled.");
        return;
      }
      setMessage(error?.message || "Subscription purchase failed.");
    },
  });

  useEffect(() => {
    finishRef.current = finishTransaction;
  }, [finishTransaction]);

  const reload = useCallback(async () => {
    if (loadingRef.current) return;
    if (!user) {
      setPlans([]);
      setAccountToken(undefined);
      setLoading(false);
      setMessage(null);
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    setMessage(null);
    try {
      const result = await request<any>("/payments/store/subscription-plans");
      setAccountToken(
        result?.accountToken != null ? String(result.accountToken) : undefined,
      );
      const parsed: SubscriptionPlan[] = [];
      for (const raw of Array.isArray(result?.plans) ? result.plans : []) {
        if (!raw || typeof raw !== "object") continue;
        const key = String(raw.key ?? "");
        const storeId = raw.storeProductIds
          ? String(
              raw.storeProductIds[Platform.OS === "ios" ? "ios" : "android"] ??
                "",
            )
          : "";
        if (key === "monthly" && storeId) {
          parsed.push({
            key,
            productId: storeId,
            billingPeriod: String(raw.billingPeriod ?? ""),
          });
        }
      }
      setPlans(parsed);
      if (retryRef.current.size > 0) {
        const retrying = [...retryRef.current.entries()];
        retryRef.current.clear();
        for (const [, purchase] of retrying) {
          try {
            await verify(purchase, restoringRef.current);
          } catch (exception) {
            setMessage(apiErrorMessage(exception));
          }
        }
      }
    } catch (exception) {
      setMessage(apiErrorMessage(exception));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [user, verify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const plan = plans.find((item) => item.key === "monthly") ?? null;
  const monthlyProductId = plan?.productId ?? null;
  const activeProductId =
    user?.subscriptionProductId ??
    plans.find((item) => item.key === user?.subscriptionPlan)?.productId ??
    null;

  const storeSkus = useMemo(() => {
    const ids = new Set<string>();
    for (const item of plans) {
      if (item.productId) ids.add(item.productId);
    }
    if (activeProductId) ids.add(activeProductId);
    return [...ids];
  }, [plans, activeProductId]);

  useEffect(() => {
    if (connected && storeSkus.length > 0) {
      void fetchProducts({ skus: storeSkus, type: "subs" }).catch((error) =>
        setMessage(apiErrorMessage(error)),
      );
    }
  }, [connected, storeSkus, fetchProducts]);

  const price =
    subscriptions.find((item) => item.id === monthlyProductId)?.displayPrice ??
    null;
  const activePrice =
    subscriptions.find((item) => item.id === activeProductId)?.displayPrice ??
    null;

  useEffect(() => {
    if (!restoringRef.current || availablePurchases.length === 0) return;
    const pending = [...availablePurchases];
    restoringRef.current = false;
    void (async () => {
      for (const purchase of pending) {
        try {
          await verify(purchase, true);
        } catch (error) {
          setMessage(
            apiErrorMessage(error) || "Could not verify a restored purchase.",
          );
        }
      }
    })();
  }, [availablePurchases, verify]);

  const buy = useCallback(async () => {
    if (busy || loading) return;
    if (!IAP_SUPPORTED) {
      setMessage(
        IS_EXPO_GO
          ? "In-app purchases are not available in Expo Go. Use a HappiNotes development build."
          : "Subscriptions can only be purchased in the HappiNotes app.",
      );
      return;
    }
    if (!connected || !monthlyProductId) {
      setMessage(
        "This subscription plan is not available yet. Please try again later.",
      );
      return;
    }
    if (!subscriptions.some((item) => item.id === monthlyProductId)) {
      setMessage(
        "This subscription plan is not available yet. Please try again later.",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await requestPurchase({
        request: {
          apple: {
            sku: monthlyProductId,
            ...(accountToken ? { appAccountToken: accountToken } : {}),
          },
          google: {
            skus: [monthlyProductId],
            ...(accountToken ? { obfuscatedAccountId: accountToken } : {}),
          },
        },
        type: "subs",
      });
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [
    accountToken,
    busy,
    connected,
    loading,
    monthlyProductId,
    requestPurchase,
    subscriptions,
  ]);

  const restore = useCallback(async () => {
    if (!connected || !accountToken) {
      setMessage(
        "The app store is unavailable or the monthly plan is not set up.",
      );
      return;
    }
    restoringRef.current = true;
    setBusy(true);
    handledRef.current.clear();
    setMessage("Checking previous subscriptions…");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (restoringRef.current) {
        restoringRef.current = false;
        setBusy(false);
        setMessage("Restore requested.");
      }
    }, 6000);
    try {
      await restorePurchases();
    } catch (error) {
      restoringRef.current = false;
      setBusy(false);
      setMessage(apiErrorMessage(error));
    }
  }, [accountToken, connected, restorePurchases]);

  const openStoreSubscriptions = useCallback(async () => {
    const url =
      Platform.OS === "android"
        ? `https://play.google.com/store/account/subscriptions?package=com.happinotes.happinotes_flutter${
            activeProductId ? `&sku=${encodeURIComponent(activeProductId)}` : ""
          }`
        : "https://apps.apple.com/account/subscriptions";
    try {
      await Linking.openURL(url);
    } catch {
      setMessage("Could not open your app store subscription settings.");
    }
  }, [activeProductId]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const value = useMemo(
    () => ({
      plans,
      plan,
      price,
      activePrice,
      loading,
      busy,
      connected,
      message,
      buy,
      restore,
      reload,
      openStoreSubscriptions,
      setMessage,
    }),
    [
      plans,
      plan,
      price,
      activePrice,
      loading,
      busy,
      connected,
      message,
      buy,
      restore,
      reload,
      openStoreSubscriptions,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("SubscriptionProvider is missing.");
  return value;
}
