import { useAppLanguage } from '@/providers/app-language';
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/providers/auth";
import { useSubscription } from "@/providers/subscription";
import { ActionButton, TextAction } from "@/components/ui/action-button";
import { dateOnly } from "@/lib/format";
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/store-links';
import { useToast } from '@/providers/toast';

export default function SubscriptionScreen() {
  const { t } = useAppLanguage();
  const { showToast } = useToast();
  const openPolicy = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { showToast(t('Could not open this policy page.'), false); }
  };
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

  const translatedPlan = t(planLabel === 'yearly' ? 'Yearly' : 'Monthly');
  let activeCopy: string;
  if (user?.subscriptionAutoRenewing === false) {
    activeCopy = t('Auto-renew is off. Premium access continues until {{expiry}}. You will not be charged again unless you subscribe again.', {
      expiry: expiry || t('the current period ends'),
    });
  } else if (user?.subscriptionAutoRenewing === true) {
    activeCopy = t('Auto-renew is on. Your {{plan}} subscription renews at {{price}} each {{period}}. Manage or cancel it in your app store settings.', {
      plan: translatedPlan,
      price: activePrice ?? t('the amount shown in your app store settings'),
      period: t(planLabel === 'yearly' ? 'year' : 'month'),
    });
    if (expiry) activeCopy += ' ' + t('Active until {{expiry}}.', { expiry });
  } else {
    activeCopy = t('Your {{plan}} subscription is active. Check your app store settings for renewal details.', { plan: translatedPlan });
    if (expiry) activeCopy += ' ' + t('Active until {{expiry}}.', { expiry });
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-row items-center px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showClose ? t("Close") : t("Go back")}
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
          <Text className="mt-4 text-center text-[24px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">{t("Unlock every premium story")}
          </Text>
          <Text className="mt-2.5 text-center text-[15px] leading-[22px] text-[#241F1C] dark:text-[#F8F5F0]">{t('Your app store handles payment and subscription settings. You can manage or cancel in {{store}} settings; if you cancel, Premium stays active until the paid period ends.', { store: storeName })}
          </Text>
        </View>

        <View className="mt-6">
          {loading ? (
            <View className="items-center py-6">
              <Text className="text-[#A8A29E]">{t("Loading…")}</Text>
            </View>
          ) : active ? (
            <View className="rounded-[14px] bg-[#16803C]/10 p-4">
              <Text className="text-center text-[15px] font-bold leading-[22px] text-[#241F1C] dark:text-[#F8F5F0]">
                {activeCopy}
              </Text>
            </View>
          ) : !plan ? (
            <Text className="text-center text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">{t("Subscription plans are not available yet.")}
            </Text>
          ) : (
            <View className="rounded-[18px] border border-[#D9D0C8]/50 p-4 dark:border-[#4A4542]">
              <Text className="text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">{t("Monthly")}
              </Text>
              <Text
                className={`mt-1 text-[24px] font-extrabold ${
                  price ? "text-coral" : "text-[#A8A29E]"
                }`}
              >
                {price ?? t("Price unavailable in this store")}
              </Text>
              <Text className="text-[13px] text-[#A8A29E]">{t('per month · billed by {{store}}', { store: storeName })}
              </Text>
              {price ? (
                <>
                  <Text className="mt-2 text-[15px] leading-[21px] text-[#241F1C] dark:text-[#F8F5F0]">{t('Renews automatically at {{price}} every month until you cancel.', { price })}
                  </Text>
                  <Text className="mt-1 text-[13px] leading-[19px] text-[#A8A29E]">{t('The store shows your final localized checkout price. Manage or cancel anytime in {{store}} settings; Premium stays active through the paid period.', { store: storeName })}
                  </Text>
                </>
              ) : null}
              <View className="mt-3 items-end">
                <ActionButton
                  label={t("Subscribe")}
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
            {t(message)}
          </Text>
        ) : null}

        <View className="mt-3">
          {canManageInStore ? (
            <TextAction
              label={t('Manage or cancel in {{store}}', { store: storeName })}
              onPress={() => void openStoreSubscriptions()}
              color="coral"
            />
          ) : null}
          <TextAction
            label={t("Restore subscription")}
            disabled={busy || loading}
            onPress={() => void restore()}
            color="coral"
          />
        </View>
        <View className="mt-4 flex-row flex-wrap justify-center gap-x-5 gap-y-2">
          <Pressable accessibilityRole="link" onPress={() => void openPolicy(PRIVACY_POLICY_URL)} className="min-h-11 justify-center">
            <Text className="text-center text-sm text-coral underline">{t('Privacy Policy')}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void openPolicy(TERMS_URL)} className="min-h-11 justify-center">
            <Text className="text-center text-sm text-coral underline">{t('Terms and Conditions')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
