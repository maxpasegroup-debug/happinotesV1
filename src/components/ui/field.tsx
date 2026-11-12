import { useAppLanguage } from '@/providers/app-language';
import { useRef, useState, type ComponentRef } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from '@/hooks/use-theme-scheme';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  autoFocus?: boolean;
  maxLength?: number;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = "default",
  multiline = false,
  editable = true,
  autoCapitalize = "none",
  autoCorrect = true,
  icon,
  autoFocus = false,
  maxLength,
  returnKeyType,
  onSubmitEditing,
}: FieldProps) {
  const { t } = useAppLanguage();
  const { colorScheme } = useColorScheme();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const hidden = secureTextEntry && !revealed;

  return (
    <View className="mb-3.5">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B625C] dark:text-[#A8A29E]">
        {t(label)}
      </Text>
      <View
        className={`flex-row items-center rounded-[14px] border bg-[#F6F6F6] px-3.5 dark:bg-[#242424] ${
          error
            ? "border-[#C62828]"
            : focused
              ? "border-coral"
              : "border-[#D9D0C8]/70 dark:border-[#4A4542]"
        } ${editable ? "" : "opacity-60"}`}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color="#A8A29E"
            style={{ marginRight: 10 }}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ? t(placeholder) : undefined}
          placeholderTextColor={colorScheme === "dark" ? "#A8A29E" : "#8B827C"}
          secureTextEntry={secureTextEntry && hidden}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoFocus={autoFocus}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          textAlignVertical={multiline ? "top" : "center"}
          className={`min-h-[50px] flex-1 py-3 text-base text-[#241F1C] dark:text-[#F8F5F0] ${
            multiline ? "min-h-[110px]" : ""
          }`}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("Show password") : t("Hide password")}
            hitSlop={8}
            onPress={() => setRevealed((current) => !current)}
            className="ml-2 p-1"
          >
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={21}
              color="#A8A29E"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="mt-1.5 text-[12px] font-semibold text-[#C62828]">
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}

export function OtpBoxes({
  value,
  onChange,
  enabled = true,
  onCompleted,
}: {
  value: string;
  onChange: (value: string) => void;
  enabled?: boolean;
  onCompleted?: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const refs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const digits = value.replace(/\D/g, "").slice(0, 6);

  const apply = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = digits.slice(0, index) + digits.slice(index + 1);
      onChange(next);
      return;
    }
    const next = (
      digits.slice(0, index) +
      clean +
      digits.slice(index + clean.length)
    )
      .replace(/\D/g, "")
      .slice(0, 6);
    onChange(next);
    const target = Math.min(index + clean.length, 5);
    refs.current[target]?.focus();
    if (next.length === 6) onCompleted?.();
  };

  return (
    <View className="flex-row gap-2">
      {Array.from({ length: 6 }, (_, index) => {
        const char = digits[index] ?? "";
        const active = focusedIndex === index;
        return (
          <View
            key={index}
            className={`h-[54px] flex-1 items-center justify-center rounded-xl border ${
              active
                ? "border-coral"
                : char
                  ? "border-coral/40 bg-coral/10"
                  : "border-[#D9D0C8]/70 dark:border-[#4A4542]"
            } bg-[#F6F6F6] dark:bg-[#242424]`}
          >
            <TextInput
              ref={(node) => {
                refs.current[index] = node;
              }}
              value={char}
              editable={enabled}
              autoFocus={index === 0}
              keyboardType="number-pad"
              maxLength={6}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(-1)}
              onChangeText={(text) => apply(index, text)}
              selectTextOnFocus
              textAlign="center"
              className="h-full w-full text-center text-[22px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]"
              placeholderTextColor={
                colorScheme === "dark" ? "#A8A29E" : "#8B827C"
              }
            />
          </View>
        );
      })}
    </View>
  );
}

export function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const { t } = useAppLanguage();
  return (
    <View className="mb-3.5">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B625C] dark:text-[#A8A29E]">
        {t(label)}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={t(option)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              className={`rounded-full px-4 py-2 ${
                selected
                  ? "bg-coral"
                  : "border border-[#D9D0C8]/70 bg-[#F6F6F6] dark:border-[#4A4542] dark:bg-[#242424]"
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  selected ? "text-white" : "text-[#514944] dark:text-[#D0C8C2]"
                }`}
              >
                {t(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
