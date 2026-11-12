import { useAppLanguage } from '@/providers/app-language';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ui/action-button';
import { useToast } from '@/providers/toast';

const POLICY_BASE = 'https://happinotes.online';

const LINKS: {
  title: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { title: 'Privacy Policy', path: '/privacy-policy', icon: 'shield-checkmark-outline' },
  { title: 'Terms and Conditions', path: '/terms', icon: 'document-text-outline' },
  {
    title: 'Subscription, Cancellation and Refund',
    path: '/subscription-policy',
    icon: 'refresh-circle-outline',
  },
  { title: 'Refund Policy', path: '/refund-policy', icon: 'receipt-outline' },
  {
    title: 'Cookies and Similar Technologies',
    path: '/cookie-policy',
    icon: 'cafe-outline',
  },
  { title: 'Acceptable Use', path: '/acceptable-use', icon: 'checkmark-done-outline' },
  {
    title: 'Content and Copyright Complaints',
    path: '/content-policy',
    icon: 'copy-outline',
  },
  {
    title: 'Grievance and Privacy Complaints',
    path: '/grievance-redressal',
    icon: 'headset-outline',
  },
  { title: 'Account Deletion', path: '/account-deletion', icon: 'trash-outline' },
];

export default function LegalScreen() {
  const { t } = useAppLanguage();
  const { showToast } = useToast();

  const open = async (path: string) => {
    try {
      await Linking.openURL(`${POLICY_BASE}${path}`);
    } catch {
      showToast('Could not open this policy page.', false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <ScreenHeader title={t("Legal")} onBack={() => router.back()} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-2">
        <Text className="text-[13px] leading-[20px] text-[#A8A29E]">{t("HappiNotes is owned and operated by AIRASKILL CITY PRIVATE LIMITED.")}
          {'\n'}{t("Registered office: 2619, T2, 6th Floor, HiLITE Business Park, HiLITE City, near Guruvayurappan College, Kozhikode – 673014, Kerala, India.")}
          {'\n'}{t("Customer support and privacy: hello@happinotes.online · +91 8089239823")}
        </Text>
        <Text className="mt-2.5 text-[13px] leading-[20px] text-[#A8A29E]">{t("These policy pages are drafts awaiting owner and legal review. Do not treat them as final terms until the published versions are approved.")}
        </Text>

        <View className="mt-5">
          {LINKS.map((link) => (
            <Pressable
              key={link.path}
              accessibilityRole="link"
              onPress={() => void open(link.path)}
              className="flex-row items-center py-3.5 active:opacity-70"
            >
              <Ionicons name={link.icon} size={22} color="#A8A29E" />
              <Text className="ml-4 flex-1 text-[16px] text-[#241F1C] dark:text-[#F8F5F0]">
                {t(link.title)}
              </Text>
              <Ionicons name="open-outline" size={18} color="#A8A29E" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
