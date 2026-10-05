// Shared building blocks for the admin screens: data loading, list shell,
// cards, pills, filter chips, pickers and an action runner (busy + toast).
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { ApiException, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Data loading ────────────────────────────────────────────
type LoadMode = 'initial' | 'pull' | 'silent';

export function useAdminList<T = Json>(fetcher: () => Promise<T[]>) {
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: LoadMode = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'pull') setRefreshing(true);
    setError(null);
    try {
      setItems((await fetchRef.current()) ?? []);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not load data. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => load('silent'), [load]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, refreshing, error, load, refresh };
}
export type AdminList<T = Json> = ReturnType<typeof useAdminList<T>>;

/** Runs a mutation with a busy flag, a toast, and a silent list refresh. */
export function useRunner(refresh: () => Promise<void> | void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>, okMessage?: string) => {
      setBusy(true);
      try {
        await fn();
        if (okMessage) toast(okMessage, 'success');
        await refresh();
        return true;
      } catch (e) {
        toast(e instanceof ApiException ? e.message : 'Something went wrong. Please try again.', 'error', 3500);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh, toast],
  );
  return { run, busy };
}

export const matches = (q: string, ...fields: unknown[]) => {
  const s = q.trim().toLowerCase();
  return !s || fields.some((f) => String(f ?? '').toLowerCase().includes(s));
};

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// ── List shell ──────────────────────────────────────────────
export function ListScreen<T>({
  list,
  data,
  keyOf,
  renderItem,
  header,
  emptyIcon = 'file-tray-outline',
  emptyLabel = 'Nothing here yet.',
  onAdd,
}: {
  list: AdminList<any>;
  data: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  header?: ReactNode;
  emptyIcon?: IconName;
  emptyLabel?: string;
  onAdd?: () => void;
}) {
  if (list.loading) return <ActivityIndicator color={colors.primary} style={{ flex: 1, backgroundColor: colors.white }} />;

  if (list.error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.white }]}>
        <Ionicons name="wifi-outline" size={32} color={colors.red} />
        <Text style={[text.bodyMedium, { textAlign: 'center', marginVertical: 12 }]}>{list.error}</Text>
        <Pressable style={styles.outlineBtn} onPress={() => list.load()}>
          <Text style={{ color: colors.primary, fontFamily: fonts.semibold }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FlatList
        data={data}
        keyExtractor={keyOf}
        renderItem={({ item }) => <>{renderItem(item)}</>}
        ListHeaderComponent={header ? <View>{header}</View> : null}
        contentContainerStyle={{ padding: 20, paddingBottom: onAdd ? 96 : 32, flexGrow: 1 }}
        refreshing={list.refreshing}
        onRefresh={() => list.load('pull')}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={[styles.center, { paddingVertical: 48 }]}>
            <Ionicons name={emptyIcon} size={40} color={colors.grey} />
            <Text style={[text.bodyMedium, { marginTop: 12 }]}>{emptyLabel}</Text>
          </View>
        }
      />
      {onAdd && (
        <Pressable style={styles.fab} onPress={onAdd} accessibilityLabel="Add">
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
      )}
    </View>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search-outline" size={18} color={colors.grey} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.black, paddingVertical: 12 }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={colors.grey} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FilterChips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.white : colors.greyText }}>{o}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── Card pieces ─────────────────────────────────────────────
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}22` }]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color }}>{label}</Text>
    </View>
  );
}

export function Meta({ icon, children }: { icon: IconName; children: ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
      <Ionicons name={icon} size={14} color={colors.grey} style={{ marginTop: 2 }} />
      <Text style={[text.bodyMedium, { flex: 1, fontSize: 13 }]}>{children}</Text>
    </View>
  );
}

export function CardActions({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>{children}</View>;
}

export function SmallButton({
  label,
  icon,
  onPress,
  tone = 'neutral',
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: 'neutral' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const c = tone === 'danger' ? colors.red : tone === 'primary' ? colors.primary : colors.greyText;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.smallBtn, { borderColor: c }, disabled && { opacity: 0.45 }]}>
      {icon ? <Ionicons name={icon} size={14} color={c} /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c }}>{label}</Text>
    </Pressable>
  );
}

// ── Sheets ──────────────────────────────────────────────────
export function PickerSheet({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  value?: string | null;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} scroll={false}>
      <Text style={[text.headingSmall, { marginBottom: 8 }]}>{title}</Text>
      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
        {options.map((o) => {
          const sel = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onPick(o.value)} style={styles.pickRow}>
              <Text style={{ flex: 1, fontFamily: sel ? fonts.semibold : fonts.regular, fontSize: 14, color: sel ? colors.primary : colors.black }}>{o.label}</Text>
              {sel && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.greyBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.greyBorder, backgroundColor: colors.white },
  card: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.greyBorder,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.greyLight },
});
