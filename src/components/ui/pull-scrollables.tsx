import { FlatList, ScrollView } from 'react-native-gesture-handler';
import { cssInterop } from 'nativewind';

// Keep the existing NativeWind layouts on Gesture Handler's native scroll views.
export const PullScrollView = cssInterop(ScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});
export const PullFlatList = cssInterop(FlatList, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
  columnWrapperClassName: 'columnWrapperStyle',
}) as typeof FlatList;
