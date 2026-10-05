// Admin live chat (port of lib/screens/admin/admin_live_chat.dart).
// Inbox of customers (live requests first) -> tap one to open the conversation.
import { Composer } from '@/components/chat/Composer';
import { MessageList } from '@/components/chat/MessageList';
import { useToast } from '@/components/Toast';
import { ErrorBanner } from '@/components/ui';
import {
  LIVE_ACTION,
  formatChatTime,
  normalizeChatUsers,
  normalizeMessages,
  usePolling,
  type ChatMessage,
  type ChatUser,
} from '@/lib/chat';
import { confirm } from '@/lib/dialogs';
import { ApiException, api } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function AdminLiveChatScreen() {
  const [open, setOpen] = useState<ChatUser | null>(null);

  // Android back returns to the inbox instead of leaving the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(null);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  return open ? <Conversation user={open} onBack={() => setOpen(null)} /> : <Inbox onOpen={setOpen} />;
}

// ── Inbox ───────────────────────────────────────────────────────────────
function Inbox({ onOpen }: { onOpen: (u: ChatUser) => void }) {
  const toast = useToast();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(normalizeChatUsers(await api.getAdminChatUsers()));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not load chats. Check your connection.');
    } finally {
      setLoaded(true);
    }
  }, []);

  usePolling(load, 5000);

  const respond = async (u: ChatUser, action: 'accept' | 'decline') => {
    setResponding(u.id);
    try {
      await api.respondToLiveRequest(u.id, LIVE_ACTION[action]);
      if (action === 'accept') onOpen({ ...u, mode: 'live', unread: 0 });
      else await load();
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not respond to the request.', 'error');
    } finally {
      setResponding(null);
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {error && (
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <ErrorBanner message={error} />
        </View>
      )}
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={users.length === 0 ? styles.center : { paddingVertical: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.grey} />
            <Text style={[text.headingSmall, { marginTop: 12 }]}>No conversations yet</Text>
            <Text style={[text.bodyMedium, { marginTop: 6, textAlign: 'center' }]}>
              Customers who start a chat will show up here.
            </Text>
          </View>
        }
        renderItem={({ item: u }) => (
          <View>
            <Pressable
              onPress={() => onOpen(u)}
              accessibilityRole="button"
              accessibilityLabel={`Open chat with ${u.name}`}
              style={({ pressed }) => [styles.userRow, pressed && { backgroundColor: colors.greyLight }]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{u.name.trim().charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={[text.label, { flexShrink: 1 }]} numberOfLines={1}>
                    {u.name}
                  </Text>
                  {u.mode === 'live' && <Text style={[styles.tag, { color: colors.green }]}>LIVE</Text>}
                </View>
                <Text style={text.bodyMedium} numberOfLines={1}>
                  {u.mode === 'pending' ? 'Requested a live chat' : u.lastMessage || 'No messages yet'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={text.bodySmall}>{formatChatTime(u.lastAt)}</Text>
                {u.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{u.unread > 99 ? '99+' : u.unread}</Text>
                  </View>
                )}
              </View>
            </Pressable>
            {u.mode === 'pending' && (
              <View style={styles.requestRow}>
                <Pressable
                  onPress={() => respond(u, 'decline')}
                  disabled={responding === u.id}
                  accessibilityRole="button"
                  style={[styles.reqBtn, styles.decline, responding === u.id && { opacity: 0.5 }]}
                >
                  <Text style={[styles.reqText, { color: colors.greyText }]}>Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => respond(u, 'accept')}
                  disabled={responding === u.id}
                  accessibilityRole="button"
                  style={[styles.reqBtn, styles.accept, responding === u.id && { opacity: 0.5 }]}
                >
                  <Text style={[styles.reqText, { color: colors.white }]}>Accept chat</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

// ── Conversation ────────────────────────────────────────────────────────
function Conversation({ user, onBack }: { user: ChatUser; onBack: () => void }) {
  const toast = useToast();
  const [server, setServer] = useState<ChatMessage[]>([]);
  const [outbox, setOutbox] = useState<ChatMessage[]>([]);
  const [offline, setOffline] = useState(false);
  const [ending, setEnding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setServer(normalizeMessages(await api.getAdminChatMessages(user.id)));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [user.id]);

  usePolling(refresh, 3000);

  const send = async (body: string) => {
    const temp: ChatMessage = { id: `local-${Date.now()}`, author: 'admin', text: body, createdAt: null };
    setOutbox((o) => [...o, temp]);
    try {
      await api.sendAdminChatMessage(user.id, body);
      await refresh();
      setOutbox((o) => o.filter((m) => m.id !== temp.id));
      return true;
    } catch (e) {
      setOutbox((o) => o.filter((m) => m.id !== temp.id));
      toast(e instanceof ApiException ? e.message : 'Message not sent. Check your connection.', 'error');
      return false;
    }
  };

  const endSession = async () => {
    const ok = await confirm('End this session?', `This ends the chat with ${user.name} and clears the history.`, {
      confirmText: 'End session',
      destructive: true,
    });
    if (!ok) return;
    setEnding(true);
    try {
      await api.endAdminChatSession(user.id);
      onBack();
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not end the session.', 'error');
      setEnding(false);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={styles.convHeader}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to chats">
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={[text.label, { flex: 1, fontSize: 16 }]} numberOfLines={1}>
          {user.name}
        </Text>
        <Pressable
          onPress={endSession}
          disabled={ending}
          accessibilityRole="button"
          accessibilityLabel="End session"
          style={ending && { opacity: 0.5 }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.red }}>End session</Text>
        </Pressable>
      </View>

      {offline && (
        <View style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.red} />
          <Text style={styles.offlineText}>Connection lost. Retrying…</Text>
        </View>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <MessageList
          messages={[...server, ...outbox]}
          viewer="admin"
          customerName={user.name}
          emptyTitle="No messages yet"
          emptyHint={`Say hello to ${user.name}.`}
        />
        <Composer onSend={send} placeholder={`Reply to ${user.name}…`} disabled={ending} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 18, color: colors.primary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { fontFamily: fonts.bold, fontSize: 10 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white },
  requestRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12, paddingLeft: 72 },
  reqBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  decline: { borderWidth: 1, borderColor: colors.greyBorder },
  accept: { backgroundColor: colors.primary },
  reqText: { fontFamily: fonts.semibold, fontSize: 13 },
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.greyBorder,
  },
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
