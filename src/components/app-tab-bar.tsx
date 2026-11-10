import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBooks } from "@/providers/books";
import { MiniPlayer } from "@/components/mini-player";

type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  descriptors: Record<string, unknown>;
  emitter: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
};

const ICONS: Record<
  string,
  {
    active: keyof typeof Ionicons.glyphMap;
    inactive: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: { active: "home", inactive: "home-outline" },
  library: { active: "bookmark", inactive: "bookmark-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const LABELS: Record<string, string> = {
  index: "Home",
  library: "Library",
  profile: "Profile",
};

export function AppTabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { loadCollection } = useBooks();

  return (
    <View className="bg-white dark:bg-[#1B1B1B]">
      <MiniPlayer />
      <View
        accessibilityRole="tablist"
        style={{ paddingBottom: Math.max(insets.bottom, 6) }}
        className="flex-row border-t border-[#D9D0C8]/60 bg-white px-2 pt-1.5 dark:border-[#4A4542]/70 dark:bg-[#1B1B1B]"
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const icon = ICONS[route.name] ?? ICONS.index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={LABELS[route.name] ?? route.name}
              onPress={() => {
                const event = emitter.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigateToTab(route.key);
                }
                if (route.name === "library") {
                  void loadCollection(true);
                }
              }}
              className="flex-1 items-center justify-center py-1.5"
            >
              <View
                style={{
                  height: 32,
                  width: 64,
                  borderRadius: 999,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: focused
                    ? "rgba(242, 95, 69, 0.15)"
                    : "transparent",
                }}
              >
                <Ionicons
                  name={focused ? icon.active : icon.inactive}
                  size={23}
                  color={focused ? "#F25F45" : "#A8A29E"}
                />
              </View>
              <Text
                className={`mt-0.5 text-xs font-bold ${
                  focused
                    ? "text-[#241F1C] dark:text-[#F8F5F0]"
                    : "text-[#6B625C] dark:text-[#A8A29E]"
                }`}
              >
                {LABELS[route.name] ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
