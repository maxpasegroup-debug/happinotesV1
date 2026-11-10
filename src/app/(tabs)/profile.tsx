import { useState } from 'react';
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
import { useAuth } from '@/providers/auth';
import { useAppTheme } from '@/providers/theme';
import { useBooks } from '@/providers/books';
import { usePlayer } from '@/providers/player';
import { useToast } from '@/providers/toast';
import { LanguageSheet } from '@/components/ui/language-sheet';
import { apiErrorMessage } from '@/lib/api';
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
        <Text
          className={`text-[16px] font-semibold ${
            danger ? 'text-[#C62828]' : 'text-[#241F1C] dark:text-[#F8F5F0]'
          }`}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-[13px] text-[#6B625C] dark:text-[#A8A29E]">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-[#D9D0C8]/50 dark:bg-[#4A4542]/60" />;
}

export default function ProfileTab() {
  const { user, updateLanguage, logout } = useAuth();
  const { dark, toggle } = useAppTheme();
  const { loadBooks, reset: resetBooks } = useBooks();
  const { stop } = usePlayer();
  const { showToast } = useToast();
  const [languageOpen, setLanguageOpen] = useState(false);

  const subscriptionActive = user?.subscriptionActive === true;

  const selectLanguage = async (language: string) => {
    setLanguageOpen(false);
    try {
      await updateLanguage(language);
      await loadBooks({
        language: language === 'all' ? undefined : language,
        forceRefresh: true,
      });
      showToast('Language preference updated');
    } catch (exception) {
      showToast(apiErrorMessage(exception), false);
    }
  };

  const signOut = async () => {
    await stop();
    await logout();
    resetBooks();
    router.replace('/');
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-[#111111]">
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <Text className="text-[28px] font-black text-[#241F1C] dark:text-[#F8F5F0]">
          Profile
        </Text>

        <View className="mt-6 items-center">
          <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-coral">
            <Text className="text-[30px] font-black text-white">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </Text>
          </View>
          <Text className="mt-3 text-center text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
            {user?.name ?? ''}
          </Text>
          <Text className="mt-0.5 text-center text-[15px] text-[#A8A29E]">
            {user?.email ?? user?.phoneNumber ?? ''}
          </Text>
        </View>

        <View className="mt-7">
          <SettingRow
            icon={dark ? 'moon' : 'sunny'}
            title="Appearance"
            subtitle={dark ? 'Dark mode' : 'Light mode'}
            trailing={
              <Switch
                value={dark}
                onValueChange={() => void toggle()}
                trackColor={{ false: '#D9D0C8', true: '#F25F4580' }}
                thumbColor={dark ? '#F25F45' : '#F4F3F4'}
              />
            }
          />
          <Divider />
          <SettingRow
            icon={subscriptionActive ? 'shield-checkmark' : 'diamond-outline'}
            title="HappiNotes Premium"
            subtitle={
              subscriptionActive
                ? `${user?.subscriptionPlan === 'yearly' ? 'Yearly' : 'Monthly'} subscription active`
                : 'Choose the monthly Premium plan'
            }
            onPress={() => router.push('/subscription')}
            trailing={<Ionicons name="chevron-forward" size={20} color="#A8A29E" />}
          />
          <Divider />
          <SettingRow
            icon="language"
            title="Language preference"
            subtitle={user?.languagePreference ?? 'all'}
            onPress={() => setLanguageOpen(true)}
            trailing={<Ionicons name="chevron-forward" size={20} color="#A8A29E" />}
          />
          <Divider />
          <SettingRow
            icon="document-text-outline"
            title="Legal"
            onPress={() => router.push('/legal')}
            trailing={<Ionicons name="chevron-forward" size={20} color="#A8A29E" />}
          />
          <Divider />
          <SettingRow
            icon="trash-outline"
            title="Delete account"
            subtitle="Permanently remove your HappiNotes account"
            danger
            onPress={() => router.push('/delete-account')}
            trailing={<Ionicons name="chevron-forward" size={20} color="#A8A29E" />}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          className="mt-5 min-h-[52px] flex-row items-center justify-center gap-2 rounded-[15px] border border-[#D9D0C8] px-5 active:opacity-70 dark:border-[#4A4542]"
        >
          <Ionicons name="log-out-outline" size={21} color="#F25F45" />
          <Text className="text-[15px] font-extrabold text-coral">Logout</Text>
        </Pressable>
      </ScrollView>

      <LanguageSheet
        visible={languageOpen}
        selected={user?.languagePreference ?? 'all'}
        onSelect={(language) => void selectLanguage(language)}
        onClose={() => setLanguageOpen(false)}
      />
    </SafeAreaView>
  );
}
