import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useToast } from '@/providers/toast';
import { ScreenHeader } from '@/components/ui/action-button';
import { Field } from '@/components/ui/field';
import { ApiError, apiErrorMessage } from '@/lib/api';
import type {
  AccountDeletionRequestStatus,
  AccountDeletionStatus,
} from '@/lib/types';

function statusTitle(status: AccountDeletionStatus) {
  switch (status) {
    case 'requested':
      return 'Deletion request received';
    case 'processing':
      return 'Deletion is processing';
    case 'failed_retryable':
      return 'Deletion will retry';
    case 'failed_manual':
      return 'Deletion needs support';
    case 'blocked_policy':
      return 'Deletion is temporarily paused';
    case 'completed':
      return 'Account deleted';
    default:
      return 'Deletion status unavailable';
  }
}

function statusBody(status: AccountDeletionStatus) {
  switch (status) {
    case 'requested':
      return 'Your request was received and account access is blocked. This does not mean deletion is complete. You can refresh status without creating another request.';
    case 'processing':
      return 'Processing removes your password, OTPs, reset and reauthentication tokens; replaces your profile name with a generic label; removes your email and phone; resets profile settings; and clears favourites, collections, push-token references, purchased-book access and HappiNotes Premium access. Your store purchase and subscription transaction records, support records, provider data, logs, backups and deletion audit handling are still awaiting policy decisions. The request will pause at the policy gate and is not complete. Google Play and Apple subscriptions are not cancelled automatically; manage or cancel them in the relevant store.';
    case 'failed_retryable':
      return 'A temporary problem interrupted processing. The backend can retry safely. Check the status again shortly.';
    case 'failed_manual':
      return 'The request needs support review. Your account remains protected and has not been reported as deleted.';
    case 'blocked_policy':
      return 'Processing is paused until the required retention and purchase/entitlement decisions are approved and implemented. Your account remains protected; this is not a completed deletion.';
    case 'completed':
      return 'The backend reports that account deletion is complete.';
    default:
      return 'The backend returned an unrecognized state. Do not submit another request; contact support.';
  }
}

function isPending(status: AccountDeletionStatus | undefined) {
  return (
    status !== undefined &&
    status !== 'completed' &&
    status !== 'unknown'
  );
}

/**
 * A 401 only means the saved session is dead for these backend messages.
 * Anything else (for example a wrong password during reauthentication) must
 * stay an inline error so the user is not signed out.
 */
function isSessionExpired(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 401) return false;
  const message = error.message ?? '';
  return (
    message.includes('Invalid or expired token') ||
    message.includes('User not found') ||
    message.includes('Account deletion is no longer available')
  );
}

function isDeletionNotFound(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.message === 'Deletion request not found'
  );
}

export default function DeleteAccountScreen() {
  const {
    logout,
    requestDeletionReauth,
    requestAccountDeletion,
    getAccountDeletionStatus,
  } = useAuth();
  const { showToast } = useToast();

  const [status, setStatus] = useState<AccountDeletionRequestStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [loading, setLoading] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [reauthVisible, setReauthVisible] = useState(false);
  const [credential, setCredential] = useState('');
  const completedHandled = useRef(false);

  const expireSession = useCallback(async () => {
    await logout();
    showToast('Your session expired. Please sign in again.', false);
    router.replace('/');
  }, [logout, showToast]);

  const handleCompleted = useCallback(
    async (result: AccountDeletionRequestStatus) => {
      if (result.status !== 'completed' || completedHandled.current) return;
      completedHandled.current = true;
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Account deletion completed',
          `The backend confirmed that the deletion workflow completed. Save this reference for support: ${
            result.reference ?? 'not available'
          }. The app will sign you out, so you will no longer be able to check status here.`,
          [{ text: 'Continue', onPress: () => resolve() }],
          { cancelable: false },
        );
      });
      await logout();
      showToast('Your HappiNotes account deletion is complete.');
      router.replace('/');
    },
    [logout, showToast],
  );

  const loadStatus = useCallback(async () => {
    setCheckingStatus(true);
    setError(null);
    try {
      const result = await getAccountDeletionStatus();
      setStatus(result);
      await handleCompleted(result);
    } catch (exception) {
      if (isDeletionNotFound(exception)) {
        setStatus(null);
      } else if (isSessionExpired(exception)) {
        await expireSession();
      } else {
        setError(apiErrorMessage(exception));
      }
    } finally {
      setCheckingStatus(false);
    }
  }, [expireSession, getAccountDeletionStatus, handleCompleted]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStatus]);

  const makeKey = () => {
    const random = Array.from({ length: 4 }, () =>
      Math.random().toString(36).slice(2),
    ).join('');
    return `${Date.now().toString(36)}-${random}`;
  };

  const submitRequest = useCallback(
    async (proofValue: string, key: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await requestAccountDeletion(proofValue, key);
        setProof(null);
        setIdempotencyKey(null);
        setStatus(result);
        await handleCompleted(result);
      } catch (exception) {
        if (isSessionExpired(exception)) {
          await expireSession();
        } else {
          setError(
            `${apiErrorMessage(exception)} If the request was accepted, use Check status before trying again.`,
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [expireSession, handleCompleted, requestAccountDeletion],
  );

  const startDeletion = async () => {
    if (loading || isPending(status?.status)) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      Alert.alert(
        'Delete your account?',
        'This request blocks access to your account. Current processing removes authentication data, anonymises ordinary profile fields, removes email and phone, clears saved preferences and device tokens, and revokes HappiNotes Premium and purchased-book access. Purchase and subscription evidence, provider records, support records, logs, backups and minimal deletion history still require approved handling, so deletion may pause before completion.\n\nDeleting your HappiNotes account does not cancel a Google Play or App Store subscription. Manage or cancel that subscription in the store before continuing if needed.',
        [
          { text: 'Keep account', style: 'cancel', onPress: () => finish(false) },
          { text: 'Continue', style: 'destructive', onPress: () => finish(true) },
        ],
        { cancelable: true, onDismiss: () => finish(false) },
      );
    });
    if (confirmed) {
      setCredential('');
      setReauthVisible(true);
    }
  };

  const verifyCredential = async () => {
    if (credential.length < 6) return;
    setReauthVisible(false);
    setLoading(true);
    setError(null);
    try {
      const nextProof = await requestDeletionReauth(credential);
      const key = idempotencyKey ?? makeKey();
      setProof(nextProof.proof);
      setIdempotencyKey(key);
      const finalConfirmed = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        Alert.alert(
          'Final confirmation',
          'Send the account-deletion request now? This cannot be undone once processing begins. Your store subscription is separate and will not be cancelled by this request.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => finish(false) },
            {
              text: 'Delete account',
              style: 'destructive',
              onPress: () => finish(true),
            },
          ],
          { cancelable: true, onDismiss: () => finish(false) },
        );
      });
      if (!finalConfirmed) {
        setProof(null);
        setIdempotencyKey(null);
        setLoading(false);
        return;
      }
      setLoading(false);
      await submitRequest(nextProof.proof, key);
    } catch (exception) {
      if (isSessionExpired(exception)) {
        await expireSession();
      } else {
        setError(apiErrorMessage(exception));
      }
      setLoading(false);
    }
  };

  const retryRequest = async () => {
    if (!proof || !idempotencyKey) {
      await loadStatus();
      return;
    }
    await submitRequest(proof, idempotencyKey);
  };

  const warning =
    status?.status === 'blocked_policy' ||
    status?.status === 'failed_manual' ||
    status?.status === 'failed_retryable';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <ScreenHeader title="Delete account" onBack={() => router.back()} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-2">
        <View className="items-center">
          <Ionicons name="trash-outline" size={64} color="#C62828" />
          <Text className="mt-4 text-center text-[24px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
            Account deletion
          </Text>
        </View>

        {error ? (
          <Text className="mt-3 text-center text-[14px] text-[#C62828]">
            {error}
          </Text>
        ) : null}

        <View className="mt-4">
          {checkingStatus ? (
            <ActivityIndicator color="#F25F45" />
          ) : status ? (
            <View
              className={`rounded-[14px] p-4 ${
                warning ? 'bg-[#F59E0B]/10' : 'bg-[#16803C]/10'
              }`}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name={warning ? 'information-circle-outline' : 'hourglass-outline'}
                  size={22}
                  color={warning ? '#B45309' : '#16803C'}
                />
                <Text className="ml-2.5 flex-1 text-[16px] font-bold text-[#241F1C] dark:text-[#F8F5F0]">
                  {statusTitle(status.status)}
                </Text>
              </View>
              <Text className="mt-2.5 text-[14px] leading-[21px] text-[#241F1C] dark:text-[#F8F5F0]">
                {statusBody(status.status)}
              </Text>
              {status.reference ? (
                <Text selectable className="mt-2.5 text-[14px] text-[#241F1C] dark:text-[#F8F5F0]">
                  Request reference: {status.reference}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={() => void loadStatus()}
                className="mt-2.5 flex-row items-center self-end rounded-lg px-2 py-2 active:bg-black/5 dark:active:bg-white/10"
              >
                <Ionicons name="refresh" size={18} color="#F25F45" />
                <Text className="ml-1.5 font-bold text-coral">
                  Refresh status
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() =>
                void (proof && idempotencyKey ? retryRequest() : startDeletion())
              }
              className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-[15px] bg-[#C62828] px-5 py-3.5 active:opacity-80 ${
                loading ? 'opacity-60' : ''
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              )}
              <Text className="text-[15px] font-extrabold text-white">
                {loading
                  ? 'Working…'
                  : proof && idempotencyKey
                    ? 'Retry deletion request'
                    : 'Start account deletion'}
              </Text>
            </Pressable>
          )}
        </View>

        {status?.status === 'failed_retryable' && proof ? (
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void retryRequest()}
            className="mt-3 min-h-[50px] items-center justify-center rounded-[15px] border border-[#D9D0C8] px-5 active:opacity-70 dark:border-[#4A4542]"
          >
            <Text className="text-[15px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
              Retry request
            </Text>
          </Pressable>
        ) : null}

        {status?.reference && status?.statusToken ? (
          <View className="mt-3 rounded-[14px] border border-[#D9D0C8]/50 p-4 dark:border-[#4A4542]">
            <Text className="text-[16px] font-bold text-[#241F1C] dark:text-[#F8F5F0]">
              Save your status details
            </Text>
            <Text className="mt-2 text-[14px] leading-[21px] text-[#241F1C] dark:text-[#F8F5F0]">
              Use these details on the public account-deletion page if this app
              session ends. Keep the status code private. It cannot be reissued
              after your contact details are erased.
            </Text>
            <Text className="mt-2 text-[14px] text-[#241F1C] dark:text-[#F8F5F0]">
              Request reference
            </Text>
            <Text selectable className="text-[14px] text-[#241F1C] dark:text-[#F8F5F0]">
              {status.reference}
            </Text>
            <Text className="mt-2 text-[14px] text-[#241F1C] dark:text-[#F8F5F0]">
              Private status code
            </Text>
            <Text selectable className="text-[14px] text-[#241F1C] dark:text-[#F8F5F0]">
              {status.statusToken}
            </Text>
          </View>
        ) : null}

        <Text className="mt-5 text-center text-[14px] leading-[21px] text-[#241F1C] dark:text-[#F8F5F0]">
          You will confirm your password or PIN before a request is sent. Save
          the reference and private status code shown after submission.
          Email-based recovery may stop once contact details are erased;
          phone-only external verification is not available.
        </Text>

        <View className="mt-5 rounded-[14px] border border-[#D9D0C8]/50 p-4 dark:border-[#4A4542]">
          <Text className="text-[16px] font-bold text-[#241F1C] dark:text-[#F8F5F0]">
            Before you continue
          </Text>
          <Text className="mt-2.5 text-[14px] leading-[21px] text-[#241F1C] dark:text-[#F8F5F0]">
            Account access, purchased-book access and HappiNotes Premium access
            are revoked during processing. Purchase and subscription records
            remain behind the policy gate, so the request may pause before
            completion.{'\n'}
            Google Play/App Store billing is separate; this action does not
            cancel it.{'\n'}
            Cancel or manage billing in the relevant store.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void loadStatus()}
          className="mt-3.5 flex-row items-center justify-center gap-2 py-3 active:opacity-70"
        >
          <Ionicons name="refresh" size={19} color="#F25F45" />
          <Text className="font-bold text-coral">Check status</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={reauthVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReauthVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 items-center justify-center bg-black/50 px-6"
        >
          <View className="w-full max-w-[420px] rounded-2xl bg-white p-5 dark:bg-[#1B1B1B]">
            <Text className="text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
              Confirm your identity
            </Text>
            <View className="mt-3">
              <Field
                label="Password or PIN"
                value={credential}
                onChangeText={setCredential}
                secureTextEntry
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => void verifyCredential()}
              />
            </View>
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => setReauthVisible(false)}
                className="rounded-lg px-4 py-2.5 active:bg-black/5 dark:active:bg-white/10"
              >
                <Text className="font-bold text-[#241F1C] dark:text-[#F8F5F0]">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={credential.length < 6}
                onPress={() => void verifyCredential()}
                className={`rounded-lg bg-coral px-4 py-2.5 active:opacity-80 ${
                  credential.length < 6 ? 'opacity-50' : ''
                }`}
              >
                <Text className="font-extrabold text-white">Verify</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
