import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/providers/auth";
import { useSubscription } from "@/providers/subscription";
import { ActionButton, TextAction } from "@/components/ui/action-button";
import { dateOnly } from "@/lib/format";

export default function SubscriptionScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const showClose = prompt === "1";
  const { user } = useAuth();
  const {
    plan,
    price,
    activePrice,
    loading,
    busy,
    message,
    buy,
    restore,
    openStoreSubscriptions,
  } = useSubscription();

  const active = user?.subscriptionActive === true;
  const isAndroid = Platform.OS === "android";
  const isIOS = Platform.OS === "ios";
  const storeName = isAndroid ? "Google Play" : "the App Store";
  const canManageInStore = isAndroid || isIOS;
  const expiry = dateOnly(user?.subscriptionExpiresAt);
  const planLabel = user?.subscriptionPlan === "yearly" ? "yearly" : "monthly";

  let activeCopy: string;
  if (user?.subscriptionAutoRenewing === false) {
    activeCopy = `Auto-renew is off. Premium access continues until ${
      expiry || "the current period ends"
    }. You will not be charged again unless you subscribe again.`;
  } else if (user?.subscriptionAutoRenewing === true) {
    activeCopy = `Auto-renew is on. Your ${planLabel} subscription renews at ${
      activePrice ?? "the amount shown in your app store settings"
    } each ${planLabel === "yearly" ? "year" : "month"}${
      expiry ? ` and is active until ${expiry}.` : "."
    } Manage or cancel it in your app store settings.`;
  } else {
    activeCopy = `Your ${planLabel} subscription is active${
      expiry ? ` until ${expiry}` : ""
    }. Check your app store settings for renewal details.`;
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-row items-center px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showClose ? "Close" : "Go back"}
          hitSlop={8}
          onPress={() =>
            showClose
              ? router.back()
              : router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/profile")
          }
          className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
        >
          <Ionicons
            name={showClose ? "close" : "arrow-back"}
            size={24}
            color="#A8A29E"
          />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
          HappiNotes Premium
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-6 pb-8 pt-3">
        <View className="items-center">
          <Ionicons name="diamond" size={64} color="#F25F45" />
          <Text className="mt-4 text-center text-[24px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
            Unlock every premium story
          </Text>
          <Text className="mt-2.5 text-center text-[15px] leading-[22px] text-[#241F1C] dark:text-[#F8F5F0]">
            Your app store handles payment and subscription settings. You can
            manage or cancel in {storeName} settings; if you cancel, Premium
            stays active until the paid period ends.
          </Text>
        </View>

        <View className="mt-6">
          {loading ? (
            <View className="items-center py-6">
              <Text className="text-[#A8A29E]">Loading…</Text>
            </View>
          ) : active ? (
            <View className="rounded-[14px] bg-[#16803C]/10 p-4">
              <Text className="text-center text-[15px] font-bold leading-[22px] text-[#241F1C] dark:text-[#F8F5F0]">
                {activeCopy}
              </Text>
            </View>
          ) : !plan ? (
            <Text className="text-center text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
              Subscription plans are not available yet.
            </Text>
          ) : (
            <View className="rounded-[18px] border border-[#D9D0C8]/50 p-4 dark:border-[#4A4542]">
              <Text className="text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
                Monthly
              </Text>
              <Text
                className={`mt-1 text-[24px] font-extrabold ${
                  price ? "text-coral" : "text-[#A8A29E]"
                }`}
              >
                {price ?? "Price unavailable in this store"}
              </Text>
              <Text className="text-[13px] text-[#A8A29E]">
                per month · billed by {storeName}
              </Text>
              {price ? (
                <>
                  <Text className="mt-2 text-[15px] leading-[21px] text-[#241F1C] dark:text-[#F8F5F0]">
                    Renews automatically at {price} every month until you
                    cancel.
                  </Text>
                  <Text className="mt-1 text-[13px] leading-[19px] text-[#A8A29E]">
                    The store shows your final localized checkout price. Manage
                    or cancel anytime in {storeName} settings; Premium stays
                    active through the paid period.
                  </Text>
                </>
              ) : null}
              <View className="mt-3 items-end">
                <ActionButton
                  label="Subscribe"
                  disabled={!price || busy}
                  onPress={() => void buy()}
                  className="min-w-[130px]"
                />
              </View>
            </View>
          )}
        </View>

        {message ? (
          <Text className="mt-3 text-center text-[14px] text-red-500">
            {message}
          </Text>
        ) : null}

        <View className="mt-3">
          {canManageInStore ? (
            <TextAction
              label={`Manage or cancel in ${storeName}`}
              onPress={() => void openStoreSubscriptions()}
              color="coral"
            />
          ) : null}
          <TextAction
            label="Restore subscription"
            disabled={busy || loading}
            onPress={() => void restore()}
            color="coral"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
