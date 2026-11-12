import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector } from 'react-native-gesture-handler';
import { useAppTheme } from '@/providers/theme';
import type { useElasticRefresh } from '@/hooks/use-elastic-refresh';

export function BookPullSurface({ motion, refreshing, children, style }: {
  motion: ReturnType<typeof useElasticRefresh>;
  refreshing: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { dark } = useAppTheme();
  const backgroundColor = dark ? '#111111' : '#FFFFFF';
  return (
    <GestureDetector gesture={motion.gesture}>
    <View collapsable={false} accessibilityState={{ busy: refreshing }} style={[styles.container, style]}>
      <Animated.View style={[styles.page, { backgroundColor }, motion.animatedStyle]}>
        {children}
        <Animated.View pointerEvents="none" accessible={false} style={[styles.dragShade, motion.shadeStyle]}>
          <LinearGradient colors={[dark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Animated.View>
      <Animated.View pointerEvents="none" accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.handTrack, motion.handStyle]}>
        {/* A sleeve, wrist and curled fingers grip the top edge of the page. */}
        <View style={styles.wrist} />
        <View style={styles.cuff} />
        <View style={[styles.pageEdge, { backgroundColor, borderColor: dark ? '#75645B' : '#D8C4B6' }]} />
        <View style={styles.palm} />
        <View style={styles.thumb} />
        {[0, 1, 2, 3].map((finger) => (
          <View key={finger} style={[styles.finger, { left: 18 + finger * 6, height: finger === 0 || finger === 3 ? 10 : 13 }]} />
        ))}
      </Animated.View>
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, overflow: 'hidden' },
  page: { flex: 1, minHeight: 0, overflow: 'hidden' },
  dragShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 12 },
  handTrack: { position: 'absolute', top: 0, left: '50%', marginLeft: -30, width: 60, zIndex: 2 },
  wrist: { position: 'absolute', top: 0, bottom: 18, left: 23, width: 14, backgroundColor: '#DFA875', borderColor: '#BE8051', borderWidth: 1, borderTopWidth: 0 },
  cuff: { position: 'absolute', top: 0, left: 19, width: 22, height: 9, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#F25F45' },
  pageEdge: { position: 'absolute', bottom: 6, left: 3, width: 54, height: 6, borderWidth: 1, borderRadius: 3 },
  palm: { position: 'absolute', bottom: 7, left: 17, width: 26, height: 23, backgroundColor: '#E8B787', borderRadius: 7, borderWidth: 1, borderColor: '#BE8051' },
  thumb: { position: 'absolute', bottom: 9, left: 12, width: 8, height: 15, borderRadius: 5, backgroundColor: '#E8B787', borderWidth: 1, borderColor: '#BE8051', transform: [{ rotate: '28deg' }] },
  finger: { position: 'absolute', bottom: 0, width: 6, borderRadius: 4, backgroundColor: '#E8B787', borderWidth: 1, borderColor: '#BE8051' },
});
