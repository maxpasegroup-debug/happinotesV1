import { useAppMotion } from '@/providers/motion';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppLanguage } from '@/providers/app-language';
import { APP_LANGUAGES, APP_LANGUAGE_NAMES, hasAppLanguageTranslations, LANGUAGE_SEARCH_ALIASES, RTL_APP_LANGUAGES } from '@/lib/translations';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { PullScrollView } from '@/components/ui/pull-scrollables';
import { useSheetDismiss } from '@/hooks/use-sheet-dismiss';

const LANGUAGES = ["all", "english", "malayalam", "hindi"];

export function LanguageSheet({
  visible,
  selected,
  onSelect,
  onClose,
  mode = 'listening',
  disabled = false,
}: {
  visible: boolean;
  selected: string;
  onSelect: (language: string) => void;
  onClose?: () => void;
  mode?: 'listening' | 'app';
  disabled?: boolean;
}) {
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const { animationsEnabled } = useAppMotion();
  const { height } = useWindowDimensions();
  const sheet = useSheetDismiss(visible, onClose, height);
  const [query, setQuery] = useState('');
  const languages = mode === 'app' ? APP_LANGUAGES : LANGUAGES;
  const matching = languages.filter(language => {
    const name = APP_LANGUAGE_NAMES[language as keyof typeof APP_LANGUAGE_NAMES] ?? t('All languages');
    const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return normalize(`${language} ${name} ${LANGUAGE_SEARCH_ALIASES[language] ?? ''}`).includes(normalize(query.trim()));
  });
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationsEnabled ? 'slide' : 'none'}
      statusBarTranslucent
      onRequestClose={sheet.dismiss}
      onShow={() => { setQuery(''); sheet.reset(); }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 justify-end bg-black/45">
      <Pressable
        className="absolute inset-0"
        accessibilityRole="button"
        accessibilityLabel={t("Close language picker")}
        onPress={sheet.dismiss}
      />
        <Animated.View
          accessibilityViewIsModal onAccessibilityEscape={sheet.dismiss}
          style={[{ paddingBottom: Math.max(insets.bottom, 12), maxHeight: Math.max(180, height - insets.top - 24) }, sheet.style]}
          className="rounded-t-3xl bg-white px-5 pt-3 dark:bg-[#1B1B1B]"
        >
          <GestureDetector gesture={sheet.gesture}>
          <View collapsable={false} className="-mx-5 -mt-3 px-5 pb-2">
            <View pointerEvents="none" className="h-10 items-center justify-center gap-1">
              <View className="h-1 w-12 rounded-full bg-[#A8A29E]" />
              {onClose ? <Ionicons name="chevron-down" size={16} color="#8C8580" /> : null}
            </View>
            <View className="flex-row items-center gap-3">
              <Text className="flex-1 text-lg font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
                {t(mode === 'app' ? 'App language' : 'Choose listening language')}
              </Text>
              {onClose ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Close')}
                  onPress={sheet.dismiss}
                  className="h-11 w-11 items-center justify-center rounded-full bg-[#F3F3F3] active:opacity-60 dark:bg-[#292929]"
                >
                  <Ionicons name="close" size={22} color="#8C8580" />
                </Pressable>
              ) : null}
            </View>
          </View>
          </GestureDetector>
          {mode === 'app' ? (
            <TextInput value={query} onChangeText={setQuery} placeholder={t('Search languages')} accessibilityLabel={t('Search languages')}
              placeholderTextColor="#A8A29E" autoCorrect={false} autoCapitalize="none"
              className="mb-2 rounded-xl bg-[#F6F6F6] px-4 py-3 text-base text-[#241F1C] dark:bg-[#292929] dark:text-[#F8F5F0]" />
          ) : null}
          <GestureDetector gesture={sheet.contentGesture}>
          <View collapsable={false} style={{ flexShrink: 1 }}>
          <PullScrollView {...sheet.scrollProps} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flexShrink: 1 }}>
          {matching.map((language) => {
            const active = selected === language;
            return (
              <Pressable
                key={language}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                onPress={() => onSelect(language)}
                className="flex-row items-center justify-between border-b border-[#D9D0C8]/40 py-4 dark:border-[#4A4542]/60"
              >
                <View className="flex-1 pr-3">
                <Text style={{ writingDirection: RTL_APP_LANGUAGES.has(language) ? 'rtl' : 'ltr' }} className="text-base text-[#241F1C] dark:text-[#F8F5F0]">
                  {language === 'all' ? t('All languages') : APP_LANGUAGE_NAMES[language as keyof typeof APP_LANGUAGE_NAMES]}
                </Text>
                {mode === 'app' && !hasAppLanguageTranslations(language) ? <Text className="mt-1 text-xs text-[#6B625C] dark:text-[#A8A29E]">{t('English fallback')}</Text> : null}
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={22} color="#F25F45" />
                ) : null}
              </Pressable>
            );
          })}
          {matching.length === 0 ? <Text className="py-5 text-center text-[#6B625C] dark:text-[#A8A29E]">{t('No languages found')}</Text> : null}
          </PullScrollView>
          </View>
          </GestureDetector>
        </Animated.View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
