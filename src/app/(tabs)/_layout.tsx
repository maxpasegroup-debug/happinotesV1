import { useAppMotion } from '@/providers/motion';
import { useEffect } from 'react';
import { Easing, View, type Animated } from 'react-native';
import { useAppTheme } from '@/providers/theme';
import { Tabs } from 'expo-router';
import { AppTabBar } from '@/components/app-tab-bar';
import { OnboardingGate } from '@/components/onboarding-gate';
import { useBooks } from '@/providers/books';

function tabSceneStyle({ current }: { current: { progress: Animated.Value } }) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
      }),
      transform: [{
        translateY: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [10, 0, 10],
          extrapolate: 'clamp',
        }),
      }],
    },
  };
}

export default function TabsLayout() {
  const { dark } = useAppTheme();
  const { animationsEnabled } = useAppMotion();
  const { loadCollection } = useBooks();
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCollection();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCollection]);
  return (
    <View className="flex-1 bg-white dark:bg-[#111111]" style={{ minHeight: 0 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          // Keep the native screen container and opacity graph stable when the
          // preference changes. Switching fade -> none can leave scenes hidden.
          // A zero-duration fade below makes disabled transitions instantaneous.
          animation: 'fade',
          sceneStyleInterpolator: tabSceneStyle,
          transitionSpec: { animation: 'timing', config: { duration: animationsEnabled ? 200 : 0, easing: Easing.out(Easing.cubic) } },
          lazy: false,
          sceneStyle: { backgroundColor: dark ? '#111111' : '#FFFFFF' },
        }}
        tabBar={(props) => <AppTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="happy-bites" options={{ title: 'Happy Bites' }} />
        <Tabs.Screen name="library" options={{ title: 'Library' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      <OnboardingGate />
    </View>
  );
}
