import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Field } from '@/components/ui/field';
import { isExpiredDeletionSession } from '@/lib/account-deletion-status';
import { apiErrorMessage } from '@/lib/api';
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
      return 'Your deletion request has been sent to the admin team and account access is blocked. Status updates automatically. This does not mean deletion is complete.';
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

function DeletionDetail({ icon, title, description }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View className="mb-4 flex-row items-start">
      <Ionicons name={icon} size={20} color="#A8A29E" style={{ marginTop: 2 }} />
      <View className="ml-3 flex-1">
        <Text className="text-[14px] font-bold text-[#241F1C] dark:text-[#F8F5F0]">{title}</Text>
        <Text className="mt-1 text-[13px] leading-[20px] text-[#6B625C] dark:text-[#A8A29E]">{description}</Text>
      </View>
    </View>
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
  const [dialog, setDialog] = useState<'intro' | 'reauth' | 'final' | 'completed' | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const operationInFlight = useRef(false);
  const requestAttempted = useRef(false);
  const statusInFlight = useRef(false);
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
      setDialog('completed');
    },
    [],
  );

  const finishDeletion = async () => {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setLoading(true);
    setDialogError(null);
    try {
      await logout();
      showToast('Your HappiNotes account deletion is complete.');
      router.replace('/');
    } catch (exception) {
      setDialogError(apiErrorMessage(exception));
    } finally {
      operationInFlight.current = false;
      setLoading(false);
    }
  };

  const loadStatus = useCallback(async (silent = false) => {
    if (statusInFlight.current) return;
    statusInFlight.current = true;
    if (!silent) setCheckingStatus(true);
    setError(null);
    try {
      const result = await getAccountDeletionStatus();
      setStatus(result);
      if (result) await handleCompleted(result);
    } catch (exception) {
      if (isExpiredDeletionSession(exception)) {
        await expireSession();
      } else {
        setError(apiErrorMessage(exception));
      }
    } finally {
      statusInFlight.current = false;
      if (!silent) setCheckingStatus(false);
    }
  }, [expireSession, getAccountDeletionStatus, handleCompleted]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (!isPending(status?.status) || loading || checkingStatus) return;
    const timer = setInterval(() => { void loadStatus(true); }, 5000);
    return () => clearInterval(timer);
  }, [status?.status, loading, checkingStatus, loadStatus]);

  const makeKey = () => {
    const random = Array.from({ length: 4 }, () =>
      Math.random().toString(36).slice(2),
    ).join('');
    return `${Date.now().toString(36)}-${random}`;
  };

  const submitRequest = useCallback(
    async (proofValue: string, key: string) => {
      if (operationInFlight.current) return;
      operationInFlight.current = true;
      requestAttempted.current = true;
      setLoading(true);
      setError(null);
      setDialogError(null);
      try {
        const result = await requestAccountDeletion(proofValue, key);
        setProof(null);
        setIdempotencyKey(null);
        requestAttempted.current = false;
        setStatus(result);
        if (result.status !== 'completed') {
          setDialog(null);
          showToast('Deletion request sent to the admin team.');
        }
        await handleCompleted(result);
      } catch (exception) {
        if (isExpiredDeletionSession(exception)) {
          await expireSession();
        } else {
          setDialog(null);
          setError(`${apiErrorMessage(exception)} If the request was accepted, use Check status before trying again.`);
        }
      } finally {
        operationInFlight.current = false;
        setLoading(false);
      }
    },
    [expireSession, handleCompleted, requestAccountDeletion, showToast],
  );

  const startDeletion = () => {
    if (loading || checkingStatus || isPending(status?.status)) return;
    setDialogError(null);
    setDialog('intro');
  };

  const closeDialog = () => {
    if (operationInFlight.current) return;
    setCredential('');
    setDialogError(null);
    if (dialog === 'final' && !requestAttempted.current) {
      setProof(null);
      setIdempotencyKey(null);
    }
    setDialog(null);
  };

  const verifyCredential = async () => {
    if (credential.length < 6 || operationInFlight.current) return;
    operationInFlight.current = true;
    setLoading(true);
    setDialogError(null);
    try {
      const nextProof = await requestDeletionReauth(credential);
      setProof(nextProof.proof);
      setIdempotencyKey(idempotencyKey ?? makeKey());
      setCredential('');
      setDialog('final');
    } catch (exception) {
      if (isExpiredDeletionSession(exception)) {
        await expireSession();
      } else {
        setDialogError(apiErrorMessage(exception));
      }
    } finally {
      operationInFlight.current = false;
      setLoading(false);
    }
  };

  const retryRequest = async () => {
    if (!proof || !idempotencyKey) {
      await loadStatus();
      return;
    }
    setDialogError(null);
    setDialog('final');
  };

  const warning =
    status?.status === 'blocked_policy' ||
    status?.status === 'failed_manual' ||
    status?.status === 'failed_retryable';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <ScreenHeader title="Delete account" onBack={() => router.back()} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <View className="items-center pb-6">
          <View className="h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#FDECE9] dark:bg-[#382321]">
            <Ionicons name="trash-outline" size={30} color="#D65348" />
          </View>
          <Text className="mt-4 text-center text-[24px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">Your account, your choice</Text>
          <Text className="mt-2 max-w-[320px] text-center text-[14px] leading-[22px] text-[#6B625C] dark:text-[#A8A29E]">
            Take a moment to review what happens before you request deletion.
          </Text>
        </View>

        <View className="rounded-[22px] bg-[#F8F6F4] p-5 dark:bg-[#1B1B1B]">
          <Text className="mb-4 text-[16px] font-bold text-[#241F1C] dark:text-[#F8F5F0]">Before you continue</Text>
          <DeletionDetail icon="lock-closed-outline" title="Account access ends" description="Your profile, saved preferences and access to purchased books and Premium are removed during processing." />
          <DeletionDetail icon="card-outline" title="Manage store subscriptions separately" description="Deleting your account does not cancel Google Play or App Store billing. Manage or cancel your subscription in the store." />
          <DeletionDetail icon="time-outline" title="Deletion may take time" description="Some records need further review. A request may pause before deletion is complete. You can check its status here." />
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
                disabled={loading || checkingStatus}
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

        <View className="mt-5 flex-row items-start px-1">
          <Ionicons name="shield-checkmark-outline" size={17} color="#A8A29E" />
          <Text className="ml-2 flex-1 text-[12px] leading-[19px] text-[#6B625C] dark:text-[#A8A29E]">
            We’ll verify your password or PIN first. Save your request reference and private status code after submitting; recovery may be unavailable once contact details are removed.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={loading || checkingStatus}
          onPress={() => void loadStatus()}
          className="mt-3.5 flex-row items-center justify-center gap-2 py-3 active:opacity-70"
        >
          <Ionicons name="refresh" size={19} color="#F25F45" />
          <Text className="font-bold text-coral">Check status</Text>
        </Pressable>
      </ScrollView>

      <ConfirmationModal
        visible={dialog !== null}
        title={dialog === 'completed' ? 'Account deletion completed' : dialog === 'reauth' ? 'Confirm your identity' : dialog === 'final' ? 'Delete your account?' : 'Ready to continue?'}
        description={dialog === 'completed'
          ? `Your deletion is complete. Save this reference for support: ${status?.reference ?? 'not available'}. Continuing will sign you out.`
          : dialog === 'reauth'
            ? 'Enter your password or PIN to protect your account. No deletion request is sent at this step.'
            : dialog === 'final'
              ? 'This sends your deletion request and blocks account access. It cannot be undone once processing begins. Your store subscription will not be cancelled.'
              : 'You’ll verify your identity, then confirm deletion. Your profile and saved content will be removed during processing. Some purchase, subscription and other records may be retained while your request is reviewed.'}
        icon={dialog === 'completed' ? 'checkmark-circle-outline' : dialog === 'reauth' ? 'lock-closed-outline' : 'trash-outline'}
        confirmLabel={dialog === 'completed' ? 'Continue to sign in' : dialog === 'reauth' ? 'Verify identity' : dialog === 'final' ? 'Delete account' : 'Continue'}
        cancelLabel={dialog === 'reauth' ? 'Cancel' : 'Keep my account'}
        destructive={dialog === 'intro' || dialog === 'final'}
        loading={loading}
        disabled={dialog === 'reauth' && credential.length < 6}
        error={dialogError}
        onCancel={dialog === 'completed' ? undefined : closeDialog}
        onConfirm={() => {
          if (dialog === 'completed') void finishDeletion();
          else if (dialog === 'reauth') void verifyCredential();
          else if (dialog === 'final' && proof && idempotencyKey) void submitRequest(proof, idempotencyKey);
          else if (dialog === 'intro') { setCredential(''); setDialog('reauth'); }
        }}
      >
        {dialog === 'reauth' ? (
          <Field
            label="Password or PIN"
            value={credential}
            onChangeText={setCredential}
            secureTextEntry
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            editable={!loading}
            onSubmitEditing={() => void verifyCredential()}
          />
        ) : null}
        {dialog === 'intro' ? (
          <View className="rounded-2xl bg-[#F8F6F4] p-4 dark:bg-[#262321]">
            <Text className="text-[13px] leading-5 text-[#6B625C] dark:text-[#B8B0AA]">Google Play and App Store subscriptions must be managed or cancelled separately in the store.</Text>
          </View>
        ) : null}
      </ConfirmationModal>
    </SafeAreaView>
  );
}
