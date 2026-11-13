import { useAppMotion } from '@/providers/motion';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/providers/auth';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { ThemePressable, ThemeText, ThemeView } from '@/components/ui/theme-motion';
import { AppearanceToggle } from '@/components/ui/appearance-toggle';
import { useBooks } from '@/providers/books';
import { usePlayer } from '@/providers/player';
import { useToast } from '@/providers/toast';
import { LanguageSheet } from '@/components/ui/language-sheet';
import { apiErrorMessage } from '@/lib/api';
import { useAppLanguage } from '@/providers/app-language';
import { APP_LANGUAGE_NAMES, isAppLanguage } from '@/lib/translations';
import type { ReactNode } from 'react';

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress && !trailing}
      onPress={onPress}
      className="flex-row items-center py-3.5 active:opacity-70"
    >
      <Ionicons
        name={icon}
        size={23}
        color={danger ? '#C62828' : '#A8A29E'}
      />
      <View className="ml-4 flex-1">
        <ThemeText
          lightColor={danger ? '#C62828' : '#241F1C'}
          darkColor={danger ? '#C62828' : '#F8F5F0'}
          className="text-[16px] font-semibold"
        >
          {title}
        </ThemeText>
        {subtitle ? (
          <ThemeText lightColor="#6B625C" darkColor="#A8A29E" className="mt-0.5 text-[13px]">
            {subtitle}
          </ThemeText>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

function Divider() {
  return <ThemeView className="h-px" lightBackground="rgba(217,208,200,0.5)" darkBackground="rgba(74,69,66,0.6)" />;
}

export default function ProfileTab() {
  const { t } = useAppLanguage();
  const { user, logout } = useAuth();
  const { language: appLanguage, setLanguage, ready: languageReady } = useAppLanguage();
  const { enabled: animationsOn, reducedMotion, ready: motionReady, setEnabled: setAnimations } = useAppMotion();
  const { reset: resetBooks } = useBooks();
  const { stop } = usePlayer();
  const { showToast } = useToast();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoutInFlight = useRef(false);

  const subscriptionActive = user?.subscriptionActive === true;

  const selectLanguage = async (language: string) => {
    if (!isAppLanguage(language)) return;
    setLanguageOpen(false);
    try {
      await setLanguage(language);
    } catch (exception) {
      showToast(apiErrorMessage(exception), false);
    }
  };

  const signOut = async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await stop();
      await logout();
      resetBooks();
      setLogoutVisible(false);
      router.replace('/');
    } catch (exception) {
      setLogoutError(apiErrorMessage(exception));
    } finally {
      logoutInFlight.current = false;
      setLoggingOut(false);
    }
  };

  return (
    <ThemeView className="flex-1" lightBackground="#FFFFFF" darkBackground="#111111">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
          <View className="flex-row items-center justify-between">
            <ThemeText lightColor="#241F1C" darkColor="#F8F5F0" className="flex-1 text-[28px] font-black">{t("Profile")}</ThemeText>
            <AppearanceToggle />
          </View>

          <View className="mt-6 flex-row items-center">
            <LinearGradient
              colors={['#FB8500', '#FFB703', '#EE9B00', '#FCA311']}
              locations={[0, 0.35, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 76, height: 76, borderRadius: 38, padding: 3, flexShrink: 0 }}
            >
              <ThemeView lightBackground="#FFFFFF" darkBackground="#111111" className="flex-1 rounded-full p-[3px]">
                <ThemeView lightBackground="#FFF5DF" darkBackground="#302414" className="flex-1 items-center justify-center rounded-full">
                  <ThemeText lightColor="#995B00" darkColor="#FFB703" className="text-[30px] font-black">
                    {Array.from(user?.name?.trim() ?? '')[0]?.toUpperCase() || 'U'}
                  </ThemeText>
                </ThemeView>
              </ThemeView>
            </LinearGradient>
            <View className="ml-4 flex-1">
              <ThemeText lightColor="#241F1C" darkColor="#F8F5F0" className="text-xl font-extrabold">{user?.name ?? ''}</ThemeText>
              <ThemeText lightColor="#6B625C" darkColor="#A8A29E" className="mt-1 text-[14px]">{user?.email ?? user?.phoneNumber ?? ''}</ThemeText>
            </View>
          </View>

          <View className="mt-7">
            <SettingRow
              icon={subscriptionActive ? 'shield-checkmark' : 'diamond-outline'}
              title="HappiNotes Premium"
              subtitle={
                subscriptionActive
                  ? t('{{plan}} subscription active', { plan: t(user?.subscriptionPlan === 'yearly' ? 'Yearly' : 'Monthly') })
                  : t("Choose the monthly Premium plan")
              }
              onPress={() => router.push('/subscription')}
              trailing={<Ionicons name="chevron-forward" size={20} color="#A8A29E" />}
            />
            <Divider />
            <SettingRow
              icon="language"
              title={t("App language")}
              subtitle={APP_LANGUAGE_NAMES[appLanguage]}
              onPress={() => setLanguageOpen(true)}
              trailing={<Ionicons name="chevron-forward" size={20} color="#A8A29E" />}
            />
            <Divider />
            <View className="flex-row items-center py-3.5">
              <Ionicons name="aperture-outline" size={23} color="#A8A29E" />
              <View className="ml-4 mr-3 flex-1">
                <ThemeText lightColor="#241F1C" darkColor="#F8F5F0" className="text-[16px] font-semibold">{t("App animations")}</ThemeText>
                <ThemeText lightColor="#6B625C" darkColor="#A8A29E" className="mt-0.5 text-[13px]">{animationsOn ? reducedMotion ? t("Paused by your device’s Reduce Motion setting") : t("Smooth screen transitions and elastic tabs") : t("Instant screens and tab switching")}</ThemeText>
              </View>
              <Switch accessibilityLabel={t("App animations")} value={animationsOn} disabled={!motionReady} onValueChange={(value) => { void setAnimations(value).catch(() => showToast('Could not save the animation preference. Please try again.', false)); }} trackColor={{ false: '#8C8580', true: '#F25F45' }} thumbColor="#FFFFFF" />
            </View>
            <Divider />
            <SettingRow
              icon="document-text-outline"
              title={t("Legal")}
              onPress={() => router.push('/legal')}
              trailing={<Ionicons name="chevron-forward" size={20} color="#A8A29E" />}
            />
          </View>

          <View className="mt-6 flex-row items-stretch gap-3">
            <ThemePressable
              accessibilityRole="button"
              onPress={() => router.push('/delete-account')}
              lightBackground="#FFF7F5" darkBackground="#241B19"
              lightBorder="#F2DAD5" darkBorder="#49302C"
              className="min-h-[56px] flex-1 flex-row items-center justify-center gap-2 rounded-[15px] border px-3 py-3 active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#D65348" />
              <ThemeText lightColor="#B83C32" darkColor="#FF9E94" className="shrink text-center text-[14px] font-bold">{t("Delete account")}</ThemeText>
            </ThemePressable>

            <ThemePressable
              accessibilityRole="button"
              onPress={() => { setLogoutError(null); setLogoutVisible(true); }}
              lightBorder="#D9D0C8" darkBorder="#4A4542"
              className="min-h-[56px] flex-1 flex-row items-center justify-center gap-2 rounded-[15px] border px-3 py-3 active:opacity-70"
            >
              <Ionicons name="log-out-outline" size={20} color="#F25F45" />
              <Text className="shrink text-center text-[14px] font-extrabold text-coral">{t("Logout")}</Text>
            </ThemePressable>
          </View>
        </ScrollView>

        <ConfirmationModal
          visible={logoutVisible}
          title={t("Log out of HappiNotes?")}
          description={t("Audio playback will stop. You can sign in again whenever you're ready to listen.")}
          icon="log-out-outline"
          confirmLabel={t("Log out")}
          cancelLabel={t("Stay signed in")}
          loading={loggingOut}
          error={logoutError}
          onConfirm={() => void signOut()}
          onCancel={() => setLogoutVisible(false)}
        />
        <LanguageSheet
          mode="app"
          disabled={!languageReady}
          visible={languageOpen}
          selected={appLanguage}
          onSelect={(language) => void selectLanguage(language)}
          onClose={() => setLanguageOpen(false)}
        />
      </SafeAreaView>
    </ThemeView>
  );
}
