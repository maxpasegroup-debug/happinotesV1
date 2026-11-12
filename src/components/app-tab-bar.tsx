import { useAppLanguage } from '@/providers/app-language';
import { useAppMotion } from '@/providers/motion';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { useEffect, useRef, useState } from 'react';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/providers/theme';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBooks } from "@/providers/books";
import { ThemeText, ThemeView } from '@/components/ui/theme-motion';
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
  "happy-bites": { active: "sparkles", inactive: "sparkles-outline" },
  library: { active: "bookmark", inactive: "bookmark-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const LABELS: Record<string, string> = {
  index: "Home",
  "happy-bites": "Bites",
  library: "Library",
  profile: "Profile",
};

function TabIcon({ focused, icon, dark }: { focused: boolean; icon: (typeof ICONS)[string]; dark: boolean }) {
  const { animationsEnabled } = useAppMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.set(animationsEnabled ? withTiming(focused ? 1 : 0, {
      duration: 110,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    }) : focused ? 1 : 0);
  }, [focused, progress, animationsEnabled]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.get() }],
  }));
  return (
    <Animated.View style={[{ height: 30, width: 48, alignItems: 'center', justifyContent: 'center' }, iconStyle]}>
      <Ionicons name={focused ? icon.active : icon.inactive} size={22} color={focused ? (dark ? '#FF9A65' : '#E75F38') : (dark ? '#A8A29E' : '#817873')} />
    </Animated.View>
  );
}

export function AppTabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const { animationsEnabled } = useAppMotion();
  const { loadCollection } = useBooks();
  const { dark } = useAppTheme();
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const selectedLayout = tabLayouts[state.routes[state.index]?.key];
  const positioned = useRef(false);
  const leadingCenter = useSharedValue(0);
  const trailingCenter = useSharedValue(0);
  const highlightTop = useSharedValue(0);
  const highlightVisible = useSharedValue(0);

  useEffect(() => {
    if (!selectedLayout) return;
    const center = selectedLayout.x + selectedLayout.width / 2;
    // The icon and label occupy 46 points inside the centered tab button.
    highlightTop.set(selectedLayout.y + (selectedLayout.height - 46) / 2 - 1);
    if (!positioned.current || !animationsEnabled) {
      leadingCenter.set(center);
      trailingCenter.set(center);
      positioned.current = true;
    } else {
      // The front arrives first; the trailing edge catches up elastically.
      // New taps retarget the current springs, without queued animations.
      leadingCenter.set(withSpring(center, { stiffness: 850, damping: 30, mass: 0.4, reduceMotion: ReduceMotion.System }));
      trailingCenter.set(withSpring(center, { stiffness: 650, damping: 32, mass: 0.5, reduceMotion: ReduceMotion.System }));
    }
    highlightVisible.set(1);
  }, [selectedLayout, leadingCenter, trailingCenter, highlightTop, highlightVisible, animationsEnabled]);

  const movingHighlightStyle = useAnimatedStyle(() => {
    const head = leadingCenter.get();
    const tail = trailingCenter.get();
    const stretch = Math.min(Math.abs(head - tail), 40);
    return {
      opacity: highlightVisible.get(),
      top: highlightTop.get(),
      transform: [
        { translateX: (head + tail) / 2 - 24 },
        { scaleX: 1 + stretch / 48 },
        { scaleY: 1 - stretch / 400 },
      ],
    };
  });

  return (
    <ThemeView lightBackground="#FFFFFF" darkBackground="#111111" style={{ flexShrink: 0 }}>
      <MiniPlayer />
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10) }}>
        <View style={{
          width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 24,
          shadowColor: '#000000', shadowOffset: { width: 0, height: 3 },
          shadowOpacity: dark ? 0.18 : 0.06, shadowRadius: 12, elevation: 3,
        }}>
          <View accessibilityRole="tablist" style={[
            { flexDirection: 'row', minHeight: 64, paddingHorizontal: 6, paddingVertical: 4,
              borderRadius: 24, overflow: 'hidden', borderWidth: 1,
              borderColor: dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(72, 43, 25, 0.08)',
              backgroundColor: nativeGlass ? 'transparent' : dark ? '#1C1B1A' : '#FFFCF9' },
            Platform.OS === 'web' ? { backdropFilter: 'blur(22px) saturate(160%)', WebkitBackdropFilter: 'blur(22px) saturate(160%)' } as ViewStyle : undefined,
          ]}>
            {nativeGlass ? <GlassView pointerEvents="none" glassEffectStyle="regular" tintColor={dark ? 'rgba(45, 36, 30, 0.35)' : 'rgba(255, 240, 224, 0.22)'} colorScheme={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
            <LinearGradient pointerEvents="none"
              colors={dark
                ? ['rgba(255, 255, 255, 0.04)', 'rgba(255, 153, 90, 0.02)', 'rgba(255, 153, 90, 0.05)']
                : ['rgba(255, 255, 255, 0.55)', 'rgba(255, 239, 222, 0.10)', 'rgba(255, 210, 172, 0.16)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Animated.View pointerEvents="none" style={[{
              position: 'absolute', left: 0, width: 48, height: 30, borderRadius: 12,
              backgroundColor: dark ? 'rgba(255, 137, 76, 0.16)' : 'rgba(242, 95, 69, 0.10)',
            }, movingHighlightStyle]} />
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const icon = ICONS[route.name] ?? ICONS.index;
              return (
                <Pressable
                  key={route.key}
                  onLayout={({ nativeEvent: { layout } }) => {
                    const { x, y, width, height } = layout;
                    setTabLayouts((current) => {
                      const previous = current[route.key];
                      if (previous?.x === x && previous?.y === y && previous?.width === width && previous?.height === height) return current;
                      return { ...current, [route.key]: { x, y, width, height } };
                    });
                  }}
                  accessibilityRole="tab"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={t(LABELS[route.name] ?? route.name)}
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
                      void loadCollection();
                    }
                  }}
                  className="flex-1 items-center justify-center py-1"
                  style={{ minHeight: 54 }}
                >
                  <TabIcon focused={focused} icon={icon} dark={dark} />
                  <ThemeText
                    lightColor={focused ? '#C74B29' : '#817873'}
                    darkColor={focused ? '#FFAD81' : '#A8A29E'}
                    className="mt-0.5 text-[11px] font-semibold"
                  >
                    {t(LABELS[route.name] ?? route.name)}
                  </ThemeText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </ThemeView>
  );
}
