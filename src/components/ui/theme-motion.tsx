import { useAppMotion } from '@/providers/motion';
import { Pressable, type PressableProps, type TextProps, type ViewProps } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { cssInterop } from 'nativewind';
import { useAppTheme } from '@/providers/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const transition = { duration: 300, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System };

type SurfaceColors = {
  lightBackground?: string;
  darkBackground?: string;
  lightBorder?: string;
  darkBorder?: string;
};

function useSurfaceStyle({ lightBackground, darkBackground, lightBorder, darkBorder }: SurfaceColors) {
  const { dark } = useAppTheme();
  const { animationsEnabled } = useAppMotion();
  // Only primitive color values enter worklets, never props or navigation data.
  const background = dark ? darkBackground : lightBackground;
  const border = dark ? darkBorder : lightBorder;
  return useAnimatedStyle(() => ({
    ...(background ? { backgroundColor: animationsEnabled ? withTiming(background, transition) : background } : {}),
    ...(border ? { borderColor: animationsEnabled ? withTiming(border, transition) : border } : {}),
  }), [background, border, animationsEnabled]);
}

/** Explicit animated primitives avoid NativeWind's dynamic animation upgrades. */
export function ThemeView({ lightBackground, darkBackground, lightBorder, darkBorder, style, ...props }: ViewProps & SurfaceColors) {
  const colors = useSurfaceStyle({ lightBackground, darkBackground, lightBorder, darkBorder });
  return <Animated.View {...props} style={[style, colors]} />;
}

export function ThemePressable({ lightBackground, darkBackground, lightBorder, darkBorder, style, ...props }: Omit<PressableProps, 'style'> & SurfaceColors & { style?: ViewProps['style'] }) {
  const colors = useSurfaceStyle({ lightBackground, darkBackground, lightBorder, darkBorder });
  return <AnimatedPressable {...props} style={[style, colors]} />;
}

export function ThemeText({ lightColor, darkColor, style, ...props }: TextProps & { lightColor: string; darkColor: string }) {
  const { dark } = useAppTheme();
  const { animationsEnabled } = useAppMotion();
  const color = dark ? darkColor : lightColor;
  const animatedStyle = useAnimatedStyle(() => ({ color: animationsEnabled ? withTiming(color, transition) : color }), [color, animationsEnabled]);
  return <Animated.Text {...props} style={[style, animatedStyle]} />;
}

// Resolve layout classes before they reach Reanimated; animation stays explicit.
cssInterop(ThemeView, { className: 'style' });
cssInterop(ThemePressable, { className: 'style' });
cssInterop(ThemeText, { className: 'style' });
