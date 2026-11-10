import { Redirect } from 'expo-router';
import { LaunchSplash } from '@/components/launch-splash';
import { useAppTheme } from '@/providers/theme';
import { useAuth } from '@/providers/auth';

export default function Index() {
  const { ready } = useAppTheme();
  const { initialized, user } = useAuth();

  if (!ready || !initialized) return <LaunchSplash />;
  if (!user) return <Redirect href="/auth" />;
  if (user.role === 'admin') return <Redirect href="/admin" />;
  return <Redirect href="/(tabs)" />;
}
