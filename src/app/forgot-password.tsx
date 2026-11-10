import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ScreenHeader, ActionButton } from '@/components/ui/action-button';
import { Field } from '@/components/ui/field';
import { useToast } from '@/providers/toast';
import { apiErrorMessage, request } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!sent) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          throw new Error('Enter a valid email address.');
        }
        await request('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        setSent(true);
      } else {
        if (!/^\d{6}$/.test(otp)) {
          throw new Error('Enter the 6-digit OTP.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await request('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp,
            newPassword: password,
          }),
        });
        showToast('Password reset successfully. You can sign in now.');
        router.back();
        return;
      }
    } catch (exception) {
      setError(apiErrorMessage(exception));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <ScreenHeader title="Forgot password" onBack={() => router.back()} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-6 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mt-4 text-[26px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
            Reset your password
          </Text>
          <Text className="mt-2.5 text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
            Enter your email address to receive a reset code.
          </Text>
          <View className="mt-6" />

          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            editable={!sent}
            keyboardType="email-address"
            icon="mail-outline"
          />
          {sent ? (
            <>
              <Field
                label="Verification code"
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                icon="checkmark-circle-outline"
              />
              <Field
                label="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                icon="lock-closed-outline"
              />
            </>
          ) : null}

          {error ? (
            <Text className="mt-3 text-center text-sm text-red-500">{error}</Text>
          ) : null}

          <View className="mt-6">
            <ActionButton
              label={sent ? 'Reset password' : 'Send reset code'}
              onPress={() => void submit()}
              loading={loading}
              loadingLabel="Please wait..."
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
