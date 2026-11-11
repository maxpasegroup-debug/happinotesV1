import { useAppMotion } from '@/providers/motion';
import { useEffect } from 'react';
import { Easing, View } from 'react-native';
import { useAppTheme } from '@/providers/theme';
import { Tabs } from 'expo-router';
import { AppTabBar } from '@/components/app-tab-bar';
import { OnboardingGate } from '@/components/onboarding-gate';
import { useBooks } from '@/providers/books';

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
          animation: animationsEnabled ? 'fade' : 'none',
          transitionSpec: { animation: 'timing', config: { duration: animationsEnabled ? 140 : 0, easing: Easing.out(Easing.cubic) } },
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
