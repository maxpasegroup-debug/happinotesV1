import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { USE_NATIVE_DRIVER } from '@/lib/app-environment';

export function LaunchSplash() {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 950,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 950,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-[#FFF8EC] px-6">
      <Animated.View style={{ transform: [{ scale }], opacity }} className="h-56 w-56 items-center justify-center rounded-full bg-saffron/15">
        <Image source={require('@/assets/images/splash-mascot.png')} resizeMode="contain" className="h-48 w-48" />
      </Animated.View>
      <Text className="mt-4 text-center text-[38px] font-black tracking-tight">
        <Text className="text-saffron">Happi</Text><Text className="text-coral">Notes</Text>
      </Text>
      <Text className="mt-2 font-semibold text-[#5B4034]">Stories that stay with you.</Text>
      <ActivityIndicator color="#F6B91A" className="mt-7" />
    </SafeAreaView>
  );
}
