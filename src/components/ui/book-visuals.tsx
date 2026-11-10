import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
        <LinearGradient
          colors={["#5B2118", "#151515"]}
          style={{ width: "100%", height: "100%" }}
        />
      )}
      {}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.9)"]}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? "Remove from library" : "Save to library"}
        onPress={(event) => {
          event.stopPropagation();
          onToggleSaved();
        }}
        className="absolute right-[14px] top-[14px] h-10 w-10 items-center justify-center rounded-full bg-black/45 active:bg-black/60"
      >
        <Ionicons
          name={saved ? "bookmark" : "bookmark-outline"}
          size={21}
          color={saved ? "#F25F45" : "#FFFFFF"}
        />
      </Pressable>
      <Text
        numberOfLines={2}
        className="absolute bottom-[18px] left-[18px] right-[18px] text-[24px] font-black leading-[25px] text-white"
      >
        {book.title}
      </Text>
    </Pressable>
  );
}
