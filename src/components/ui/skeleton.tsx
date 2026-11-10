import { useEffect, useState } from "react";
import { Animated, View, useWindowDimensions } from "react-native";
import { USE_NATIVE_DRIVER } from '@/lib/app-environment';

export function SkeletonBox({
  width,
  height,
  radius = 10,
  className = "",
}: {
  width?: number | `${number}%`;
  height: number | `${number}%`;
  radius?: number;
  className?: string;
}) {
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 600,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 600,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={`bg-[#ECEAE8] dark:bg-[#2C2C2C] ${className}`}
      style={{ width, height, borderRadius: radius, opacity }}
    />
  );
}

export function HomeLoadingSkeleton() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(152, Math.max(124, width * 0.36));
  const coverHeight = cardWidth / 0.72;
  const featuredHeight = Math.min(374, Math.max(300, width * 0.95));
  return (
    <View>
      <SkeletonBox height={featuredHeight} radius={22} />
      <View className="mt-7">
        <SkeletonBox width={150} height={20} />
      </View>
      <View className="mt-3 flex-row gap-4">
        {[0, 1, 2].map((item) => (
          <View key={item} style={{ width: cardWidth }}>
            <SkeletonBox height={coverHeight} radius={12} />
            <View className="mt-2.5">
              <SkeletonBox height={14} />
            </View>
            <View className="mt-2">
              <SkeletonBox width={90} height={11} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Two-column grid placeholder.
 *
 * `sidePadding` must equal the total horizontal padding the grid is laid out
 * inside, otherwise two cards cannot fit on a row and every row wraps to a
 * single card pinned to the left. Search owns its own `px-4`; Library is
 * already wrapped in `px-5`, so it passes empty padding and 40 instead.
 */
export function GridLoadingSkeleton({
  className = 'px-4 pt-4',
  sidePadding = 32,
  columns = 2,
  rowGap = 18,
}: {
  className?: string;
  sidePadding?: number;
  columns?: number;
  rowGap?: number;
} = {}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - sidePadding - rowGap) / columns);
  const coverHeight = cardWidth / 0.72;

  return (
    <View
      className={`content-start flex-row flex-wrap justify-between gap-y-4 ${className}`}
    >
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <View key={item} style={{ width: cardWidth }}>
          <SkeletonBox height={coverHeight} radius={12} />
          <View className="mt-2.5">
            <SkeletonBox height={14} />
          </View>
          <View className="mt-2">
            <SkeletonBox width={90} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <View className="px-5 py-4">
      <SkeletonBox width={180} height={28} />
      <View className="mt-2.5">
        <SkeletonBox width={250} height={14} />
      </View>
      <View className="mt-6 flex-row gap-3">
        <View className="flex-1">
          <SkeletonBox height={130} radius={14} />
        </View>
        <View className="flex-1">
          <SkeletonBox height={130} radius={14} />
        </View>
      </View>
      <View className="mt-3 flex-row gap-3">
        <View className="flex-1">
          <SkeletonBox height={130} radius={14} />
        </View>
        <View className="flex-1">
          <SkeletonBox height={130} radius={14} />
        </View>
      </View>
    </View>
  );
}
