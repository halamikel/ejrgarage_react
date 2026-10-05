// Admin > Live Chat. Backend: admin/get_chat_users.php, get_messages.php,
// send_message.php, accept_session.php, end_session.php.
// chat_session per customer is 'bot' (talking to the bot), 'waiting' (asked for a
// human) or 'live' (an admin accepted). Both views poll while the screen is focused.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card, ListScreen, Pill, SmallButton, useAdminList, useRunner } from '@/components/admin';
import { useToast } from '@/components/Toast';
import { confirm } from '@/lib/dialogs';
import { ApiException, api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

const sessionMeta = (s: string) =>
  s === 'live' ? { label: 'Live', color: colors.green } : s === 'waiting' ? { label: 'Needs agent', color: '#ED9E00' } : { label: 'Bot', color: colors.grey };

export default function AdminLiveChat() {
  const users = useAdminList(() => api.getAdminChatUsers().then((r) => r.users as Json[]));
  const [selected, setSelected] = useState<Json | null>(null);

  // Keep the conversation list fresh while no chat is open.
  useFocusEffect(
    useCallback(() => {
      if (selected) return undefined;
      const t = setInterval(users.refresh, 5000);
      return () => clearInterval(t);
    }, [selected, users.refresh]),
  );

  // Customers waiting for an agent float to the top.
  const data = useMemo(() => {
    const rank = (u: Json) => (u.chat_session === 'waiting' ? 0 : u.chat_session === 'live' ? 1 : 2);
    return [...users.items].sort((a, b) => rank(a) - rank(b));
  }, [users.items]);

  if (selected) {
    return (
      <Conversation
        user={selected}
        onBack={() => {
          setSelected(null);
          users.refresh();
        }}
      />
    );
  }

  return (
    <ListScreen
      list={users}
      data={data}
      keyOf={(u) => String(u.id)}
      emptyIcon="chatbubbles-outline"
      emptyLabel="No conversations yet."
      renderItem={(u) => {
        const meta = sessionMeta(String(u.chat_session));
        const unread = Number(u.unread_count) || 0;
        return (
          <Pressable onPress={() => setSelected(u)}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.primary }}>{String(u.full_name ?? '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{u.full_name}</Text>
                    <Pill label={meta.label} color={meta.color} />
                  </View>
                  <Text numberOfLines={1} style={[text.bodySmall, { marginTop: 2 }]}>{u.last_message}</Text>
                </View>
                {unread > 0 && (
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.white, fontFamily: fonts.bold, fontSize: 12 }}>{unread}</Text>
                  </View>
                )}
              </View>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

function Conversation({ user, onBack }: { user: Json; onBack: () => void }) {
  const toast = useToast();
  const userId = Number(user.id);
  const [messages, setMessages] = useState<Json[]>([]);
  const [mode, setMode] = useState<string>(String(user.chat_session ?? 'bot'));
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getAdminChatMessages(userId);
      setMessages(res.messages ?? []);
      if (res.chat_session) setMode(String(res.chat_session));
    } catch (e) {
      // Polling failures are silent; only tell the admin if the first load fails.
      setLoaded((was) => {
        if (!was) toast(e instanceof ApiException ? e.message : 'Could not load messages.', 'error');
        return was;
      });
    } finally {
      setLoaded(true);
    }
  }, [userId, toast]);

  const { run, busy } = useRunner(load);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 3000);
      return () => clearInterval(t);
    }, [load]),
  );

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  async function send() {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      await api.sendAdminChatMessage(userId, msg);
      setInput('');
      await load();
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Message not sent. Try again.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function endSession() {
    const ok = await confirm('End Session?', `End the chat with ${user.full_name}? This clears the conversation and returns them to the bot.`, {
      confirmText: 'End Session',
      destructive: true,
    });
    if (!ok) return;
    const done = await run(() => api.endAdminChatSession(userId), 'Session ended.');
    if (done) onBack();
  }

  const meta = sessionMeta(mode);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.greyBorder }}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back to conversations">
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16 }}>{user.full_name}</Text>
        <Pill label={meta.label} color={meta.color} />
        {mode === 'live' && <SmallButton label="End" icon="close-circle-outline" tone="danger" disabled={busy} onPress={endSession} />}
      </View>

      {mode === 'waiting' && (
        <View style={{ padding: 14, backgroundColor: colors.primaryLight, gap: 10 }}>
          <Text style={[text.bodyMedium, { color: colors.black }]}>{user.full_name} is asking to talk to a person.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SmallButton label="Accept" icon="checkmark-circle-outline" tone="primary" disabled={busy} onPress={() => run(() => api.respondToLiveRequest(userId, 'accept'), 'Chat accepted.')} />
            <SmallButton label="Decline" icon="close-outline" tone="danger" disabled={busy} onPress={() => run(() => api.respondToLiveRequest(userId, 'decline'), 'Request declined.')} />
          </View>
        </View>
      )}

      {!loaded ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {messages.length === 0 && <Text style={[text.bodyMedium, { textAlign: 'center', marginTop: 40 }]}>No messages yet.</Text>}
          {messages.map((m, i) => {
            const mine = m.sender === 'admin';
            const bot = m.sender !== 'admin' && m.sender !== 'user';
            return (
              <View key={i} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {bot && <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.grey, marginBottom: 2 }}>Bot</Text>}
                <View
                  style={{
                    maxWidth: '82%',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 16,
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                    backgroundColor: mine ? colors.primary : bot ? colors.primaryLight : colors.greyLight,
                  }}
                >
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: mine ? colors.white : colors.black }}>{m.message}</Text>
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.grey, marginTop: 2 }}>{m.time}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {mode === 'live' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.greyBorder }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message"
            placeholderTextColor={colors.grey}
            onSubmitEditing={send}
            returnKeyType="send"
            style={{ flex: 1, borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14, color: colors.black }}
          />
          <Pressable
            onPress={send}
            disabled={sending || !input.trim()}
            accessibilityLabel="Send"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: sending || !input.trim() ? 0.5 : 1 }}
          >
            {sending ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={18} color={colors.white} />}
          </Pressable>
        </View>
      ) : (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.greyBorder }}>
          <Text style={[text.bodySmall, { textAlign: 'center' }]}>
            {mode === 'waiting' ? 'Accept the request to start replying.' : 'This customer is chatting with the bot. You can reply once they ask for an agent.'}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}