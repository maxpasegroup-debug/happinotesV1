import { useAppLanguage } from '@/providers/app-language';
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Variant = "primary" | "secondary" | "danger";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Replaces the label while loading, like Flutter's "Please wait…" buttons. */
  loadingLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
};

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  loadingLabel,
  icon,
  className = "",
}: ActionButtonProps) {
  const { t } = useAppLanguage();
  const isDisabled = disabled || loading;
  const primary = variant === "primary";
  const danger = variant === "danger";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-[15px] px-5 py-3.5 active:opacity-80 ${
        primary
          ? "bg-coral"
          : danger
            ? "bg-[#C62828]"
            : "border border-[#D9D0C8] bg-transparent dark:border-[#4A4542]"
      } ${isDisabled ? "opacity-50" : ""} ${className}`}
    >
      {loading && !loadingLabel ? (
        <ActivityIndicator
          size="small"
          color={primary || danger ? "#FFFFFF" : "#F25F45"}
        />
      ) : !loading && icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={primary || danger ? "#FFFFFF" : "#F25F45"}
        />
      ) : null}
      <Text
        className={`text-[15px] font-extrabold ${
          primary || danger
            ? "text-white"
            : "text-[#241F1C] dark:text-[#F8F5F0]"
        }`}
      >
        {t(loading && loadingLabel ? loadingLabel : label)}
      </Text>
    </Pressable>
  );
}

export function TextAction({
  label,
  onPress,
  disabled = false,
  color = "coral",
  className = "",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: "coral" | "muted" | "danger";
  className?: string;
}) {
  const { t } = useAppLanguage();
  const tone =
    color === "danger"
      ? "text-[#C62828]"
      : color === "muted"
        ? "text-[#6B625C] dark:text-[#A8A29E]"
        : "text-coral";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2 py-3 active:opacity-70 ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      <Text className={`text-[15px] font-bold ${tone}`}>{t(label)}</Text>
    </Pressable>
  );
}

export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  tint = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  tint?: "default" | "coral" | "white";
}) {
  const { t } = useAppLanguage();
  const color =
    tint === "coral" ? "#F25F45" : tint === "white" ? "#FFFFFF" : "#A8A29E";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(accessibilityLabel)}
      hitSlop={8}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-black/10"
    >
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  onBack,
  right,
  subtitle,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  const { t } = useAppLanguage();
  return (
    <View className="flex-row items-center gap-1 px-2 py-2">
      <HeaderIconButton
        icon="arrow-back"
        accessibilityLabel={t("Go back")}
        onPress={onBack}
      />
      <View className="flex-1">
        <Text className="text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
          {t(title)}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-[#6B625C] dark:text-[#A8A29E]">
            {t(subtitle)}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
