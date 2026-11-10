import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { Book } from "@/lib/types";

export function Cover({
  book,
  radius = 12,
  className = "",
  large = false,
}: {
  book: Book;
  radius?: number;
  className?: string;
  large?: boolean;
}) {
  return (
    <View
      className={`overflow-hidden bg-[#F0EBE8] dark:bg-[#242424] ${className}`}
      style={{ borderRadius: radius }}
    >
      {book.coverImageUrl ? (
        <Image
          source={{ uri: book.coverImageUrl }}
          contentFit="cover"
          transition={160}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <View
          className={`flex-1 items-center justify-center ${
            large ? "bg-[#3A1914]" : ""
          }`}
        >
          <Text
            className={`font-black text-coral ${
              large ? "text-6xl" : "text-[42px]"
            }`}
          >
            {book.title ? book.title[0].toUpperCase() : "?"}
          </Text>
          {large ? (
            <Text
              numberOfLines={2}
              className="mx-4 mt-2 text-center text-lg font-extrabold text-stone-200"
            >
              {book.title}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function useBookCardWidth() {
  const { width } = useWindowDimensions();
  return Math.min(152, Math.max(124, width * 0.36));
}

export function BookCard({
  book,
  onPress,
  width,
}: {
  book: Book;
  onPress: () => void;
  width?: number;
}) {
  const fallback = useBookCardWidth();
  const cardWidth = width ?? fallback;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={book.title}
      onPress={onPress}
      style={{ width: cardWidth }}
      className="active:opacity-80"
    >
      <View
        style={{ width: cardWidth, height: cardWidth / 0.72 }}
        className="overflow-hidden rounded-xl bg-[#F0EBE8] dark:bg-[#242424]"
      >
        <Cover book={book} radius={12} className="h-full w-full" />
      </View>
      <Text
        numberOfLines={2}
        className="mt-2 text-sm font-bold leading-[17px] text-[#241F1C] dark:text-[#F8F5F0]"
      >
        {book.title}
      </Text>
      <Text
        numberOfLines={1}
        className="mt-[3px] text-[11px] leading-[14px] text-[#6B625C] dark:text-[#A8A29E]"
      >
        {book.language} •{" "}
        {book.accessType === "premium" ? "Premium subscription" : "Free"}
      </Text>
    </Pressable>
  );
}

export function FeaturedCard({
  book,
  width,
  height,
  saved,
  onPress,
  onToggleSaved,
}: {
  book: Book;
  width: number;
  height: number;
  saved: boolean;
  onPress: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={book.title}
      onPress={onPress}
      style={{ width, height }}
      className="overflow-hidden rounded-3xl active:opacity-90"
    >
      {book.coverImageUrl ? (
        <Image
          source={{ uri: book.coverImageUrl }}
          contentFit="cover"
          transition={180}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <View className="h-full w-full bg-[#3A1914]" />
      )}
      <View className="absolute inset-0 bg-black/15" />
      <View className="absolute inset-x-0 bottom-0 h-1/2 bg-black/30" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? "Remove from library" : "Save to library"}
        onPress={(event) => {
          event.stopPropagation();
          onToggleSaved();
        }}
        className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-black/45 active:bg-black/60"
      >
        <Ionicons
          name={saved ? "bookmark" : "bookmark-outline"}
          size={21}
          color={saved ? "#F25F45" : "#FFFFFF"}
        />
      </Pressable>
      <Text
        numberOfLines={2}
        className="absolute bottom-4 left-4 right-4 text-2xl font-black leading-[26px] text-white"
      >
        {book.title}
      </Text>
    </Pressable>
  );
}
