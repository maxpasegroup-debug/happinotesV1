import { useAppTheme } from '@/providers/theme';

/**
 * Drop-in replacement for `useColorScheme()` from `nativewind`.
 *
 * NativeWind's hook reports the *system* appearance; the app keeps its own
 * persisted light/dark choice (applied as the `dark` class on the root View),
 * so anything that needs a raw colour value must read that instead of the
 * system value, otherwise colours disagree with the rendered theme.
 */
export function useColorScheme() {
  const { dark } = useAppTheme();
  return { colorScheme: dark ? ('dark' as const) : ('light' as const) };
}
