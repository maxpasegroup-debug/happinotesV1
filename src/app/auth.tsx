import { useAppLanguage } from '@/providers/app-language';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ActionButton, TextAction } from '@/components/ui/action-button';
import { Field, OtpBoxes } from '@/components/ui/field';
import { useAuth } from '@/providers/auth';
import { useToast } from '@/providers/toast';
import { apiErrorMessage } from '@/lib/api';

type AuthStep = 'email' | 'otp' | 'password';

export default function AuthScreen() {
  const { t } = useAppLanguage();
  const {
    user,
    requestEmailOtp,
    verifyEmailOtp,
    signup,
    login,
  } = useAuth();
  const { showToast } = useToast();

  const [isSignup, setIsSignup] = useState(false);
  const [step, setStep] = useState<AuthStep>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [challenge, setChallenge] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user) router.replace('/');
  }, [user]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(
      () => setResendSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(
    () => () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
    },
    [],
  );

  const startCooldown = (seconds: number) => {
    if (resendTimer.current) clearInterval(resendTimer.current);
    setResendSeconds(seconds > 0 ? Math.floor(seconds) : 60);
  };

  const changeEmail = () => {
    setStep('email');
    setOtp('');
    setChallenge('');
    setResendSeconds(0);
    setError(null);
  };

  const toggleMode = () => {
    setIsSignup((current) => !current);
    setStep('email');
    setName('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setChallenge('');
    setResendSeconds(0);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (step === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Enter a valid email address.');
        return;
      }
    } else if (step === 'otp') {
      if (otp.length !== 6) {
        setError('Enter the 6-digit OTP.');
        return;
      }
    } else {
      if (isSignup && !name.trim()) {
        setError('Enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (isSignup && password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (step === 'email') {
        if (isSignup) {
          const seconds = await requestEmailOtp(email.trim());
          startCooldown(seconds);
          setStep('otp');
        } else {
          setStep('password');
        }
      } else if (step === 'otp') {
        const emailChallenge = await verifyEmailOtp(email.trim(), otp);
        setChallenge(emailChallenge);
        setResendSeconds(0);
        setStep('password');
      } else if (isSignup) {
        await signup(name.trim(), email.trim(), password, challenge);
        showToast('Your account was created successfully');
        router.replace('/');
      } else {
        await login(email.trim(), password);
        showToast('Login successful');
        router.replace('/');
      }
    } catch (exception) {
      setError(apiErrorMessage(exception));
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!isSignup || step !== 'otp' || loading) return;
    if (resendSeconds > 0) {
      setError(t('Please wait {{seconds}} seconds before requesting another code.', { seconds: resendSeconds }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const seconds = await requestEmailOtp(email.trim());
      startCooldown(seconds);
      showToast('A new OTP was sent to your email.');
    } catch (exception) {
      setError(apiErrorMessage(exception));
    } finally {
      setLoading(false);
    }
  };

  const heading =
    step === 'email'
      ? isSignup
        ? 'Create your account'
        : 'Welcome back'
      : step === 'otp'
        ? 'Verify your email'
        : 'Enter your password';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-[480px] self-center">
            <Image
              source={require('@/assets/images/happinotes-logo.png')}
              contentFit="contain"
              style={{ height: 140, width: '100%' }}
            />
            <Text className="text-center text-[26px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
              {t(heading)}
            </Text>
            <View className="mt-7" />

            {step === 'email' ? (
              <Field
                label={t("Email address")}
                value={email}
                onChangeText={(value) => {
                  setEmail(value.trim());
                  setError(null);
                }}
                error={
                  email !== '' &&
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                    ? 'Enter a valid email address'
                    : undefined
                }
                keyboardType="email-address"
                icon="mail-outline"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => void submit()}
              />
            ) : null}

            {step === 'otp' ? (
              <View>
                <Text className="mb-3.5 text-center text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">{t('We sent a 6-digit code to {{email}}', { email })}
                </Text>
                <OtpBoxes
                  value={otp}
                  onChange={setOtp}
                  enabled={!loading}
                  onCompleted={() => void submit()}
                />
                <TextAction
                  label={
                    resendSeconds > 0
                      ? t('Resend code in {{seconds}}s', { seconds: resendSeconds })
                      : t("Resend code")
                  }
                  disabled={loading || resendSeconds > 0}
                  onPress={() => void resendOtp()}
                  className="mt-2 self-center"
                />
              </View>
            ) : null}

            {step === 'password' ? (
              <View>
                {!isSignup ? (
                  <Text className="mb-3.5 text-center text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">{t('Signing in as {{email}}', { email })}
                  </Text>
                ) : null}
                {isSignup ? (
                  <Field
                    label={t("Full name")}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    icon="person-outline"
                  />
                ) : null}
                <Field
                  label={t("Password")}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  icon="lock-closed-outline"
                  returnKeyType="done"
                  onSubmitEditing={() => void submit()}
                />
                {isSignup ? (
                  <Field
                    label={t("Confirm password")}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    icon="lock-closed-outline"
                  />
                ) : null}
              </View>
            ) : null}

            {error ? (
              <Text className="mt-1 text-center text-sm text-red-500">
                {t(error)}
              </Text>
            ) : null}

            <View className="mt-5">
              <ActionButton
                label={
                  step === 'email'
                    ? t("Continue")
                    : step === 'otp'
                      ? t("Verify email")
                      : isSignup
                        ? t("Create account")
                        : t("Sign in")
                }
                onPress={() => void submit()}
                loading={loading}
                loadingLabel="Please wait..."
              />
            </View>

            {step !== 'email' ? (
              <TextAction
                label={t("Change email")}
                disabled={loading}
                onPress={changeEmail}
              />
            ) : (
              <>
                <TextAction
                  label={
                    isSignup
                      ? t("Already have an account? Sign in")
                      : t("New to HappiNotes? Create account")
                  }
                  disabled={loading}
                  onPress={toggleMode}
                />
                {!isSignup ? (
                  <TextAction
                    label={t("Forgot password?")}
                    disabled={loading}
                    onPress={() => router.push('/forgot-password')}
                  />
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
