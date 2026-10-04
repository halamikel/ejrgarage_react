// Port of _openInquireSheet in available_parts_screen.dart (bottom sheet form).
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Field, PrimaryButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { ApiException, api, type Json } from '@/services/api';
import { userSession } from '@/services/session';
import { colors, text } from '@/theme/theme';

export function InquirySheet({ part, onClose }: { part: Json | null; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});
  const [sending, setSending] = useState(false);

  // Prefill from the profile each time the sheet opens for a part.
  useEffect(() => {
    if (!part) return;
    const u = userSession.user;
    setName(String(u?.full_name ?? u?.name ?? ''));
    setContact(String(u?.phone ?? ''));
    setMessage('');
    setErrors({});
  }, [part]);

  async function submit() {
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Enter your name';
    if (contact.trim().length < 7) next.contact = 'Enter a valid contact number';
    setErrors(next);
    if (next.name || next.contact || !part) return;

    setSending(true);
    try {
      await api.submitPartInquiry({
        partId: parseInt(String(part.id), 10),
        customerName: name.trim(),
        contact: contact.trim(),
        message: message.trim(),
      });
      onClose();
      toast('Inquiry sent! We will contact you shortly.', 'success');
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Failed to submit inquiry.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={part != null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
        <View style={{ backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: 12 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.greyBorder, marginBottom: 16 }} />
            <Text style={text.headingSmall}>Request / Inquire</Text>
            <Text style={[text.bodyMedium, { color: colors.primary, marginTop: 4, marginBottom: 20 }]}>{part?.name ?? ''}</Text>
            <Field label="Your Name" placeholder="Your Name" value={name} onChangeText={setName} error={errors.name} testID="inquiry_name_field" />
            <Field
              label="Contact Number"
              placeholder="Contact Number"
              value={contact}
              onChangeText={setContact}
              keyboardType="phone-pad"
              error={errors.contact}
              testID="inquiry_contact_field"
            />
            <Field
              label="Message (Optional)"
              placeholder="Message (Optional)"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
              style={{ minHeight: 70, textAlignVertical: 'top' }}
              testID="inquiry_message_field"
            />
            <PrimaryButton title="Submit Inquiry" onPress={submit} loading={sending} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
