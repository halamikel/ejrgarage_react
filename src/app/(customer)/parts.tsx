// Port of lib/screens/customer/available_parts_screen.dart.
// (Header + cart badge are configured in (customer)/_layout.tsx.)
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { InquirySheet } from '@/components/InquirySheet';
import { useToast } from '@/components/Toast';
import { confirm } from '@/lib/dialogs';
import { iconForPartCategory, peso } from '@/lib/format';
import { ApiException, api, type Json } from '@/services/api';
import { cart } from '@/services/cart';
import { colors, fonts, text } from '@/theme/theme';

const CATEGORIES: [string, string][] = [
  ['', 'All Categories'],
  ['engine', 'Engine'],
  ['brakes', 'Brakes'],
  ['suspension', 'Suspension'],
  ['electrical', 'Electrical'],
];

export default function AvailablePartsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parts, setParts] = useState<Json[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [inquiryPart, setInquiryPart] = useState<Json | null>(null);

  const load = useCallback(
    async (cat = category) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getParts({ search: search.trim(), category: cat });
        setParts((res.parts as Json[]) ?? []);
      } catch (e) {
        setError(e instanceof ApiException ? e.message : 'Could not load parts. Check your connection.');
      } finally {
        setLoading(false);
      }
    },
    [search, category],
  );

  useEffect(() => {
    cart.load();
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requireLogin(action: string) {
    if (await confirm('Login Required', `Please log in to ${action}.`, { confirmText: 'Log In' })) {
      router.push('/login');
    }
  }

  async function addToCart(part: Json) {
    if (!(await api.isLoggedIn())) return requireLogin('add items to cart');
    const name: string = part.name ?? '';
    const stock = parseInt(String(part.stock ?? 0), 10) || 0;
    const added = cart.add(String(part.id), name, parseFloat(String(part.price ?? 0)) || 0, stock);
    toast(added ? `${name} added to cart` : `Only ${stock} in stock — you already have that many in your cart`, added ? 'success' : 'error', 1400);
  }

  async function inquire(part: Json) {
    if (!(await api.isLoggedIn())) return requireLogin('submit an inquiry');
    setInquiryPart(part);
  }

  const header = (
    <View style={{ paddingBottom: 8 }}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search parts..."
          placeholderTextColor={colors.grey}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={() => load()}
        />
        <Pressable onPress={() => load()} hitSlop={10} accessibilityLabel="Search">
          <Ionicons name="search" size={22} color={colors.primary} />
        </Pressable>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={([k]) => k || 'all'}
        contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
        renderItem={({ item: [key, label] }) => {
          const selected = category === key;
          return (
            <Pressable
              onPress={() => {
                setCategory(key);
                load(key);
              }}
              style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: selected ? colors.white : colors.black }}>{label}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FlatList
        style={{ flex: 1 }}
        data={loading || error ? [] : parts}
        keyExtractor={(p, i) => String(p.id ?? i)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
          ) : error ? (
            <View style={{ alignItems: 'center', padding: 32 }}>
              <Ionicons name="wifi-outline" size={32} color={colors.red} />
              <Text style={[text.bodyMedium, { textAlign: 'center', marginVertical: 12 }]}>{error}</Text>
              <Pressable style={styles.outlineBtn} onPress={() => load()}>
                <Text style={{ color: colors.primary, fontFamily: fonts.semibold }}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ alignItems: 'center', padding: 32 }}>
              <Ionicons name="construct-outline" size={40} color={colors.grey} />
              <Text style={[text.bodyMedium, { marginTop: 12 }]}>No parts found.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <PartCard part={item} onAdd={addToCart} onInquire={inquire} />}
      />
      <InquirySheet part={inquiryPart} onClose={() => setInquiryPart(null)} />
    </View>
  );
}

function PartCard({ part, onAdd, onInquire }: { part: Json; onAdd: (p: Json) => void; onInquire: (p: Json) => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const category: string = part.category ?? '';
  const price = parseFloat(String(part.price ?? 0)) || 0;
  const stock = parseInt(String(part.stock ?? 0), 10) || 0;
  const inStock = stock > 0;
  const imageUrl: string | null = part.image_url || null;

  return (
    <View style={styles.card}>
      <View style={styles.imageBox}>
        {imageUrl && !imgFailed ? (
          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" onError={() => setImgFailed(true)} />
        ) : (
          <Ionicons name={iconForPartCategory(category)} size={44} color={colors.grey} />
        )}
        {category.length > 0 && (
          <View style={styles.catPill}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.primary }}>{category}</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 10, flex: 1 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{part.name ?? ''}</Text>
        <Text numberOfLines={2} style={[text.bodySmall, { marginTop: 2 }]}>{part.description ?? ''}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary, marginTop: 6 }}>{peso(price)}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, marginVertical: 4, color: inStock ? colors.green : colors.red }}>
          {inStock ? `${stock} in stock` : 'Out of stock'}
        </Text>
        {inStock ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable style={[styles.addBtn, { flex: 1 }]} onPress={() => onAdd(part)}>
              <Text style={{ color: colors.white, fontFamily: fonts.semibold, fontSize: 11 }}>Add to Cart</Text>
            </Pressable>
            <Pressable style={styles.inquireBtn} onPress={() => onInquire(part)} accessibilityLabel="Inquire">
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.addBtn, { backgroundColor: colors.greyBorder }]}>
            <Text style={{ color: colors.grey, fontFamily: fonts.semibold, fontSize: 11 }}>Out of Stock</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.greyBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 14, fontFamily: fonts.regular },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.greyBorder },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  card: {
    flex: 1,
    maxWidth: '50%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.greyBorder,
  },
  imageBox: { height: 110, backgroundColor: colors.greyLight, alignItems: 'center', justifyContent: 'center' },
  catPill: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  addBtn: { height: 34, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  inquireBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
