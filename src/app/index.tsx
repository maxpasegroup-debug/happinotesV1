import { useAppMotion } from '@/providers/motion';
import { Redirect } from 'expo-router';
import { LaunchSplash } from '@/components/launch-splash';
import { useAppTheme } from '@/providers/theme';
import { useAuth } from '@/providers/auth';

export default function Index() {
  const { ready: motionReady } = useAppMotion();
  const { ready } = useAppTheme();
  const { initialized, user } = useAuth();

  if (!ready || !motionReady || !initialized) return <LaunchSplash />;
  if (!user) return <Redirect href="/auth" />;
  if (user.role === 'admin') return <Redirect href="/admin" />;
  return <Redirect href="/(tabs)" />;
}
