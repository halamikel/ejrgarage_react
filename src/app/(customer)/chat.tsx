// Port of lib/screens/customer/live_chat_screen.dart.
// Backend: check_session.php "type" dispatcher (get_messages / chat / end_session).
//
// How the backend works (and why this screen is built the way it is):
//  - Bot mode: the server answers each message from its keyword table but does
//    NOT store the conversation, so the bot half of the chat lives in this app.
//  - "request_live" puts the customer straight into a LIVE session and wipes the
//    stored history. From then on messages are stored server-side, so they are
//    polled with get_messages. The admin's own live-chat screen shows the same thread.
//  - end_session returns the customer to the bot and deletes the live history.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pill, SmallButton } from '@/components/admin';
import { useToast } from '@/components/Toast';
import { confirm } from '@/lib/dialogs';
import { ApiException, api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

type Msg = { sender: 'user' | 'bot' | 'admin'; message: string; time: string };

const GREETING =
  'Hi! I\'m the EJR Garage assistant. Ask me about our services, prices, hours or booking, or tap "Talk to a live agent" to chat with our team.';
const LIVE_INTRO = 'You are now connected to EJR Garage support. How can we help you?';
// Internal lines the backend inserts for the admin's benefit; customers shouldn't see them.
const SYSTEM_LINES = ['A customer has started a live chat.', 'A user has requested live assistance.'];

// Same quick choices as the website's chat widget. Each is sent as the user's
// message and matches a keyword in the backend's ejr_bot table.
const QUICK_CHOICES = ['Services Offered', 'Booking Help', 'Operating Hours', 'Location', 'Contact'];

const nowLabel = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const botMsg = (message: string): Msg => ({ sender: 'bot', message, time: nowLabel() });

export default function ChatScreen() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'bot' | 'live'>('bot');
  const [botMsgs, setBotMsgs] = useState<Msg[]>([botMsg(GREETING)]);
  const [liveMsgs, setLiveMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /** Asks the server whether we're in a live session and, if so, loads it. */
  const sync = useCallback(async () => {
    try {
      const res = await api.getChatMessages();
      if (res.chat_session === 'live') {
        setMode('live');
        const list: Json[] = res.messages ?? [];
        setLiveMsgs(
          list
            .filter((m) => !SYSTEM_LINES.includes(String(m.message)))
            .map((m) => ({ sender: m.sender === 'user' ? 'user' : 'admin', message: String(m.message), time: String(m.time ?? '') })),
        );
      } else if (modeRef.current === 'live') {
        // The admin ended the session.
        setMode('bot');
        setLiveMsgs([]);
        setBotMsgs([botMsg('The live chat has ended. I\'m back, so how can I help?')]);
      }
    } catch {
      // Polling failures are silent; the next tick will try again.
    }
  }, []);

  // On focus: check for a live session, and while live keep polling.
  useFocusEffect(
    useCallback(() => {
      let stopped = false;
      sync().finally(() => !stopped && setReady(true));
      if (mode !== 'live') return () => { stopped = true; };
      const t = setInterval(sync, 3000);
      return () => {
        stopped = true;
        clearInterval(t);
      };
    }, [mode, sync]),
  );

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [botMsgs.length, liveMsgs.length, typing, mode, ready]);

  async function send(preset?: string) {
    const msg = (preset ?? input).trim();
    if (!msg || busy) return;
    if (preset == null) setInput(''); // tapping a choice shouldn't wipe what's being typed
    setBusy(true);

    if (mode === 'live') {
      setLiveMsgs((p) => [...p, { sender: 'user', message: msg, time: nowLabel() }]);
      try {
        await api.sendChatMessage(msg);
        await sync();
      } catch (e) {
        toast(e instanceof ApiException ? e.message : 'Message not sent. Try again.', 'error');
      } finally {
        setBusy(false);
      }
      return;
    }

    setBotMsgs((p) => [...p, { sender: 'user', message: msg, time: nowLabel() }]);
    setTyping(true);
    try {
      const res = await api.sendChatMessage(msg);
      if (res.mode === 'live') await sync(); // a live session was already open
      else setBotMsgs((p) => [...p, botMsg(String(res.reply || 'Sorry, I didn\'t catch that.'))]);
    } catch {
      setBotMsgs((p) => [...p, botMsg('Sorry, I couldn\'t reach the server. Please try again.')]);
    } finally {
      setTyping(false);
      setBusy(false);
    }
  }

  async function requestLive() {
    const ok = await confirm('Talk to a Live Agent?', 'A member of the EJR Garage team will join this chat.', { confirmText: 'Connect' });
    if (!ok) return;
    setBusy(true);
    try {
      await api.sendChatMessage('', 'request_live');
      setMode('live');
      setLiveMsgs([]);
      await sync();
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not connect you to an agent.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function endLive() {
    const ok = await confirm('End Live Chat?', 'This ends the chat and clears the conversation.', { confirmText: 'End Chat', destructive: true });
    if (!ok) return;
    setBusy(true);
    try {
      await api.endChatSession();
      setMode('bot');
      setLiveMsgs([]);
      setBotMsgs([botMsg(GREETING)]);
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not end the chat.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const shown: Msg[] = mode === 'live' ? [{ sender: 'admin', message: LIVE_INTRO, time: '' }, ...liveMsgs] : botMsgs;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.greyBorder }}>
        <View style={{ flex: 1 }}>
          <Text style={text.headingMedium}>Chat Support</Text>
          <Text style={text.bodySmall}>{mode === 'live' ? 'Chatting with the EJR Garage team' : 'Automated assistant'}</Text>
        </View>
        <Pill label={mode === 'live' ? 'Live' : 'Bot'} color={mode === 'live' ? colors.green : colors.grey} />
        {mode === 'live' && <SmallButton label="End" icon="close-circle-outline" tone="danger" disabled={busy} onPress={endLive} />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!ready ? (
          <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
        ) : (
          <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {shown.map((m, i) => {
              const mine = m.sender === 'user';
              const isBot = m.sender === 'bot';
              return (
                <View key={i} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  {!mine && <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.grey, marginBottom: 2 }}>{isBot ? 'Assistant' : 'Support'}</Text>}
                  <View
                    style={{
                      maxWidth: '82%',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 16,
                      borderBottomRightRadius: mine ? 4 : 16,
                      borderBottomLeftRadius: mine ? 16 : 4,
                      backgroundColor: mine ? colors.primary : isBot ? colors.primaryLight : colors.greyLight,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: mine ? colors.white : colors.black }}>{m.message}</Text>
                  </View>
                  {m.time ? <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.grey, marginTop: 2 }}>{m.time}</Text> : null}
                </View>
              );
            })}
            {typing && (
              <View style={{ alignItems: 'flex-start' }}>
                <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderBottomLeftRadius: 4, backgroundColor: colors.primaryLight }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.greyText }}>Typing...</Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {mode === 'bot' && ready && (
          <View style={{ paddingTop: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {QUICK_CHOICES.map((q) => (
                <Pressable
                  key={q}
                  disabled={busy}
                  onPress={() => send(q)}
                  accessibilityLabel={q}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.primaryLight, opacity: busy ? 0.5 : 1 }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.primary }}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, alignItems: 'flex-start' }}>
              <SmallButton label="Talk to a live agent" icon="headset-outline" tone="primary" disabled={busy} onPress={requestLive} />
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.greyBorder, marginTop: 8 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message"
            placeholderTextColor={colors.grey}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            editable={ready}
            style={{ flex: 1, borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14, color: colors.black }}
          />
          <Pressable
            onPress={() => send()}
            disabled={busy || !input.trim()}
            accessibilityLabel="Send"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: busy || !input.trim() ? 0.5 : 1 }}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={18} color={colors.white} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}