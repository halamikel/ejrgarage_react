// Scrolling conversation view shared by the customer and admin chat screens.
import { formatChatDay, formatChatTime, type ChatAuthor, type ChatMessage } from '@/lib/chat';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

type Row =
  | { type: 'day'; key: string; label: string }
  | { type: 'msg'; key: string; msg: ChatMessage };

type Props = {
  messages: ChatMessage[];
  /** Whose messages are drawn on the right. */
  viewer: Exclude<ChatAuthor, 'bot'>;
  /** Label for the customer's bubbles when the viewer is staff. */
  customerName?: string;
  emptyTitle: string;
  emptyHint?: string;
};

export function MessageList({ messages, viewer, customerName, emptyTitle, emptyHint }: Props) {
  const listRef = useRef<FlatList<Row>>(null);
  // Only auto-scroll when the reader is already at the bottom, so polling
  // doesn't yank them away while they're reading older messages.
  const stick = useRef(true);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay: string | null = null;
    messages.forEach((msg) => {
      const day = formatChatDay(msg.createdAt);
      if (day && day !== lastDay) {
        out.push({ type: 'day', key: `day-${day}`, label: day });
        lastDay = day;
      }
      out.push({ type: 'msg', key: msg.id, msg });
    });
    return out;
  }, [messages]);

  const labelFor = (a: ChatAuthor) =>
    a === 'bot' ? 'EJR Assistant' : a === 'admin' ? 'EJR Staff' : (customerName ?? 'Customer');

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="chatbubbles-outline" size={44} color={colors.grey} />
        <Text style={[text.headingSmall, { marginTop: 12, textAlign: 'center' }]}>{emptyTitle}</Text>
        {emptyHint ? <Text style={[text.bodyMedium, { marginTop: 6, textAlign: 'center' }]}>{emptyHint}</Text> : null}
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(r) => r.key}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onScroll={(e) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        stick.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
      }}
      scrollEventThrottle={100}
      onContentSizeChange={() => {
        if (stick.current) listRef.current?.scrollToEnd({ animated: true });
      }}
      renderItem={({ item }) => {
        if (item.type === 'day') {
          return (
            <View style={styles.dayWrap}>
              <Text style={styles.dayText}>{item.label}</Text>
            </View>
          );
        }
        const { msg } = item;
        const mine = msg.author === viewer;
        const bot = msg.author === 'bot';
        const time = formatChatTime(msg.createdAt);
        return (
          <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
            {!mine && <Text style={styles.sender}>{labelFor(msg.author)}</Text>}
            <View style={[styles.bubble, mine ? styles.bubbleMine : bot ? styles.bubbleBot : styles.bubbleTheirs]}>
              <Text style={[styles.body, mine && { color: colors.white }]}>{msg.text}</Text>
            </View>
            {time ? <Text style={styles.time}>{time}</Text> : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  dayText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.greyText,
    backgroundColor: colors.greyLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: { marginVertical: 4, maxWidth: '82%' },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { fontFamily: fonts.medium, fontSize: 11, color: colors.greyText, marginBottom: 2, marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.greyLight, borderBottomLeftRadius: 4 },
  bubbleBot: {
    backgroundColor: colors.primaryLight,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(237,91,28,0.2)',
  },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.black },
  time: { fontFamily: fonts.regular, fontSize: 10, color: colors.grey, marginTop: 2, marginHorizontal: 4 },
});
