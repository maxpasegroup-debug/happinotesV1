import { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { AppTabBar } from '@/components/app-tab-bar';
import { OnboardingGate } from '@/components/onboarding-gate';
import { useBooks } from '@/providers/books';

export default function TabsLayout() {
  const { loadCollection } = useBooks();

  // Flutter's MainShell loads the saved collection as soon as it appears, so
  // Home can show correct bookmark states before Library is ever opened.
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCollection();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCollection]);

  return (
    <View className="flex-1 bg-white dark:bg-[#111111]">
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <AppTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="library" options={{ title: 'Library' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      <OnboardingGate />
    </View>
  );
}
