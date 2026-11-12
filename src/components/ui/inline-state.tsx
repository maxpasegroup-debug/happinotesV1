import { useAppLanguage } from '@/providers/app-language';
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function InlineState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = useAppLanguage();
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <Ionicons name={icon} size={44} color="#F25F45" />
      <Text className="mt-3.5 text-center text-base font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
        {t(title)}
      </Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-[#A8A29E]">
        {t(message)}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          className="mt-3 flex-row items-center gap-1 rounded-lg px-3 py-2 active:bg-black/5 dark:active:bg-white/10"
        >
          <Ionicons name="refresh" size={18} color="#F25F45" />
          <Text className="font-bold text-coral">{t(actionLabel)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const { t } = useAppLanguage();
  return (
    <Text className="text-xl font-black text-[#241F1C] dark:text-[#F8F5F0]">
      {t(children)}
    </Text>
  );
}
