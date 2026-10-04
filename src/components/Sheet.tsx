// Generic bottom sheet (Flutter's showModalBottomSheet).
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { colors } from '@/theme/theme';

export function Sheet({
  visible,
  onClose,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  scroll?: boolean;
}) {
  const body = (
    <>
      <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.greyBorder, marginBottom: 16 }} />
      {children}
    </>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' }}>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
              {body}
            </ScrollView>
          ) : (
            <View style={{ padding: 20, paddingBottom: 28 }}>{body}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
