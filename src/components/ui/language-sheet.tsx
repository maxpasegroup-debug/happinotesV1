import { useAppMotion } from '@/providers/motion';
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppLanguage } from '@/providers/app-language';
import { APP_LANGUAGE_NAMES } from '@/lib/translations';

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
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationsEnabled ? 'slide' : 'none'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end bg-black/45"
        accessibilityRole="button"
        accessibilityLabel={t("Close language picker")}
        onPress={onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          className="rounded-t-3xl bg-white px-5 pt-3 dark:bg-[#1B1B1B]"
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-[#A8A29E]" />
          <Text className="pb-2 text-lg font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
            {t(mode === 'app' ? 'App language' : 'Choose listening language')}
          </Text>
          {LANGUAGES.filter((language) => mode === 'listening' || language !== 'all').map((language) => {
            const active = selected === language;
            return (
              <Pressable
                key={language}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                disabled={disabled}
                onPress={() => onSelect(language)}
                className="flex-row items-center justify-between border-b border-[#D9D0C8]/40 py-4 dark:border-[#4A4542]/60"
              >
                <Text className="text-base text-[#241F1C] dark:text-[#F8F5F0]">
                  {language === 'all' ? t('All languages') : APP_LANGUAGE_NAMES[language as keyof typeof APP_LANGUAGE_NAMES]}
                </Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={22} color="#F25F45" />
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
