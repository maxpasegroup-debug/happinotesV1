import { useAppMotion } from '@/providers/motion';
import { Redirect } from 'expo-router';
import { LaunchSplash } from '@/components/launch-splash';
import { useAppTheme } from '@/providers/theme';
import { useAuth } from '@/providers/auth';
import { useAppLanguage } from '@/providers/app-language';

export default function Index() {
  const { ready: languageReady } = useAppLanguage();
  const { ready: motionReady } = useAppMotion();
  const { ready } = useAppTheme();
  const { initialized, user } = useAuth();

  if (!ready || !motionReady || !languageReady || !initialized) return <LaunchSplash />;
  if (!user) return <Redirect href="/auth" />;
  if (user.role === 'admin') return <Redirect href="/admin" />;
  return <Redirect href="/(tabs)" />;
}
