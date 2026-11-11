import { useAppMotion } from '@/providers/motion';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from './action-button';

export function ConfirmationModal({
  visible, title, description, icon, confirmLabel, cancelLabel = 'Cancel',
  destructive = false, loading = false, disabled = false, error,
  onConfirm, onCancel, children,
}: {
  visible: boolean;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel?: () => void;
  children?: ReactNode;
}) {
  const { animationsEnabled } = useAppMotion();
  const dismiss = () => { if (!loading) onCancel?.(); };

  return (
    <Modal visible={visible} transparent animationType={animationsEnabled ? 'fade' : 'none'} onRequestClose={dismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
            <Pressable
              accessible={false}
              onPress={dismiss}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            />
            <View accessibilityViewIsModal onAccessibilityEscape={dismiss} className="w-full max-w-[420px] self-center overflow-hidden rounded-[28px] bg-white dark:bg-[#1B1B1B]" style={{ maxHeight: '100%' }}>
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24 }}>
                <View className={`mb-5 h-14 w-14 items-center justify-center rounded-2xl ${destructive ? 'bg-[#FDECE9] dark:bg-[#382321]' : 'bg-[#FFF0E8] dark:bg-[#352720]'}`}>
                  <Ionicons name={icon} size={27} color={destructive ? '#D65348' : '#F25F45'} />
                </View>
                <Text accessibilityRole="header" className="text-[23px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">{title}</Text>
                <Text className="mt-2 text-[14px] leading-[22px] text-[#6B625C] dark:text-[#B8B0AA]">{description}</Text>
                {children ? <View className="mt-5">{children}</View> : null}
                {error ? <Text accessibilityRole="alert" className="mt-4 text-sm leading-5 text-[#C62828] dark:text-[#FF9E94]">{error}</Text> : null}
                <View className="mt-6 gap-2">
                  <ActionButton label={confirmLabel} variant={destructive ? 'danger' : 'primary'} loading={loading} disabled={disabled} onPress={onConfirm} />
                  {onCancel ? <ActionButton label={cancelLabel} variant="secondary" disabled={loading} onPress={dismiss} /> : null}
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
