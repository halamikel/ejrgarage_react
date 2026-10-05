// Customer live chat (port of lib/screens/customer/live_chat_screen.dart).
//
// Three modes, driven by the server:
//   bot     -> automated assistant answers
//   pending -> customer asked for a person and is waiting for staff to accept
//   live    -> talking to staff
import { Composer } from '@/components/chat/Composer';
import { MessageList } from '@/components/chat/MessageList';
import { useToast } from '@/components/Toast';
import { chatModeOf, normalizeMessages, usePolling, type ChatMessage, type ChatMode } from '@/lib/chat';
import { confirm } from '@/lib/dialogs';
import { ApiException, api } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS: Record<ChatMode, { label: string; color: string }> = {
  bot: { label: 'Automated assistant', color: colors.blue },
  pending: { label: 'Waiting for a staff member…', color: colors.statusPending },
  live: { label: 'Live with EJR staff', color: colors.green },
};

const PLACEHOLDER: Record<ChatMode, string> = {
  bot: 'Ask about services, prices, hours…',
  pending: 'Message the assistant while you wait…',
  live: 'Message our staff…',
};

export default function CustomerChatScreen() {
  const toast = useToast();
  const [server, setServer] = useState<ChatMessage[]>([]);
  // Messages the user just sent that the server hasn't echoed back yet.
  const [outbox, setOutbox] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>('bot');
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getChatMessages();
      setServer(normalizeMessages(res));
      setMode(chatModeOf(res));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  // Poll faster while a human is (or is about to be) on the other end.
  usePolling(refresh, mode === 'bot' ? 10000 : 3000);

  const fail = (e: unknown, fallback: string) =>
    toast(e instanceof ApiException ? e.message : fallback, 'error');

  const send = async (body: string) => {
    const temp: ChatMessage = { id: `local-${Date.now()}`, author: 'customer', text: body, createdAt: null };
    setOutbox((o) => [...o, temp]);
    try {
      await api.sendChatMessage(body);
      await refresh();
      setOutbox((o) => o.filter((m) => m.id !== temp.id));
      return true;
    } catch (e) {
      setOutbox((o) => o.filter((m) => m.id !== temp.id));
      fail(e, 'Message not sent. Check your connection.');
      return false;
    }
  };

  const handoff = async (action: 'request_live' | 'cancel_live_request') => {
    setBusy(true);
    try {
      await api.sendChatMessage('', action);
      await refresh();
    } catch (e) {
      fail(e, 'Could not update your request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    const ok = await confirm('End live chat?', 'This ends the session and clears the conversation history.', {
      confirmText: 'End chat',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.endChatSession();
      setServer([]);
      setOutbox([]);
      setMode('bot');
      await refresh();
    } catch (e) {
      fail(e, 'Could not end the chat. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const status = STATUS[mode];
  const action =
    mode === 'bot'
      ? { label: 'Talk to a person', icon: 'headset-outline' as const, onPress: () => handoff('request_live'), color: colors.primary }
      : mode === 'pending'
        ? { label: 'Cancel request', icon: 'close-circle-outline' as const, onPress: () => handoff('cancel_live_request'), color: colors.greyText }
        : { label: 'End chat', icon: 'exit-outline' as const, onPress: endSession, color: colors.red };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={text.headingSmall}>EJR Support</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: status.color }]} />
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>
        <Pressable
          onPress={action.onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={[styles.actionBtn, { borderColor: action.color }, busy && { opacity: 0.5 }]}
        >
          <Ionicons name={action.icon} size={16} color={action.color} />
          <Text style={[styles.actionText, { color: action.color }]}>{action.label}</Text>
        </Pressable>
      </View>

      {offline && (
        <View style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.red} />
          <Text style={styles.offlineText}>Can't reach support. Retrying…</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <MessageList
          messages={[...server, ...outbox]}
          viewer="customer"
          emptyTitle="Start a conversation"
          emptyHint="Ask our assistant a question, or tap “Talk to a person” to chat with the shop."
        />
        <Composer onSend={send} placeholder={PLACEHOLDER[mode]} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.greyBorder,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontFamily: fonts.regular, fontSize: 12, color: colors.greyText },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionText: { fontFamily: fonts.semibold, fontSize: 12 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(244,67,54,0.08)',
  },
  offlineText: { fontFamily: fonts.regular, fontSize: 12, color: colors.red },
});
