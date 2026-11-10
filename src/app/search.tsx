import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useBooks } from "@/providers/books";
import { BookCard } from "@/components/ui/book-visuals";
import { GridLoadingSkeleton } from "@/components/ui/skeleton";
import { InlineState } from "@/components/ui/inline-state";
import type { Book } from "@/lib/types";

export default function SearchScreen() {
  const { books, loading, error, loadBooks } = useBooks();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");

  useEffect(
    () => () => {
      void loadBooks({ forceRefresh: true });
    },
    [loadBooks],
  );

  const onChange = (value: string) => {
    setQuery(value);
    void loadBooks({ query: value.trim() });
  };

  const cardWidth = (width - 32 - 18) / 2;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-row items-center px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
        >
          <Ionicons name="arrow-back" size={24} color="#A8A29E" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
          Search
        </Text>
      </View>

      <View className="px-4 pt-2">
        <Text className="text-[28px] font-black text-[#241F1C] dark:text-[#F8F5F0]">
          Discover
        </Text>
        <View className="mt-3.5 h-[52px] flex-row items-center rounded-[14px] border border-[#D9D0C8]/60 bg-[#F6F6F6] px-4 dark:border-[#4A4542] dark:bg-[#242424]">
          <Ionicons name="search" size={20} color="#A8A29E" />
          <TextInput
            value={query}
            onChangeText={onChange}
            onSubmitEditing={() => void loadBooks({ query: query.trim() })}
            placeholder="Search books"
            placeholderTextColor="#A8A29E"
            autoCapitalize="none"
            returnKeyType="search"
            className="ml-3 flex-1 py-3 text-base text-[#241F1C] dark:text-[#F8F5F0]"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => onChange("")}
              className="p-1"
            >
              <Ionicons name="close-circle" size={20} color="#A8A29E" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="mt-3 flex-1">
        {loading ? (
          <GridLoadingSkeleton />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            title="Search is unavailable"
            message={error}
            actionLabel="Try again"
            onAction={() => void loadBooks({ query: query.trim() })}
          />
        ) : books.length === 0 ? (
          <InlineState
            icon="search-outline"
            title="No stories found"
            message="Try another title."
          />
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            contentContainerClassName="gap-y-4 px-4 pb-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: Book }) => (
              <BookCard
                book={item}
                width={cardWidth}
                onPress={() =>
                  router.push({
                    pathname: "/book/[id]",
                    params: { id: item.id },
                  })
                }
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
