// Admin > Parts. Backend: admin/manage_parts.php (list/add/edit/delete) and
// admin/upload_part_image.php (Cloudinary-backed, <3MB JPG/PNG/WEBP/GIF).
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, CardActions, FilterChips, ListScreen, Pill, SearchBar, SmallButton, cap, useAdminList, useRunner, matches } from '@/components/admin';
import { Select } from '@/components/Select';
import { Sheet } from '@/components/Sheet';
import { Field, PrimaryButton } from '@/components/ui';
import { confirm } from '@/lib/dialogs';
import { peso } from '@/lib/format';
import { api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

const BASE_CATEGORIES = ['engine', 'brakes', 'suspension', 'electrical'];

type Form = {
  id?: number;
  name: string;
  brand: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  imageUrl: string;
  picked?: { uri: string; name?: string | null; type?: string | null };
};

export default function AdminParts() {
  const list = useAdminList(() => api.getAdminParts().then((r) => r.parts as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const extra = list.items.map((p) => String(p.category ?? '').toLowerCase()).filter(Boolean);
    return Array.from(new Set([...BASE_CATEGORIES, ...extra]));
  }, [list.items]);

  const data = useMemo(
    () => list.items.filter((p) => (cat === 'All' || String(p.category).toLowerCase() === cat.toLowerCase()) && matches(q, p.name, p.brand, p.category)),
    [list.items, q, cat],
  );

  const openForm = (p?: Json) => {
    setError(null);
    setForm(
      p
        ? {
            id: Number(p.id),
            name: p.name ?? '',
            brand: p.brand ?? '',
            description: p.description ?? '',
            category: String(p.category ?? 'engine').toLowerCase(),
            price: String(p.price ?? ''),
            stock: String(p.stock ?? '0'),
            imageUrl: p.image_url ?? '',
          }
        : { name: '', brand: '', description: '', category: 'engine', price: '', stock: '0', imageUrl: '' },
    );
  };

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setForm((f) => f && { ...f, picked: { uri: a.uri, name: a.fileName, type: a.mimeType } });
  }

  async function save() {
    if (!form) return;
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock || '0', 10);
    if (!form.name.trim()) return setError('Part name is required.');
    if (Number.isNaN(price) || price <= 0) return setError('Enter a valid price.');
    if (Number.isNaN(stock) || stock < 0) return setError('Enter a valid stock count.');
    setError(null);
    const f = form;
    const ok = await run(async () => {
      let imageUrl = f.imageUrl;
      if (f.picked) {
        const up = await api.uploadPartImage(f.picked);
        imageUrl = up.image_url ?? imageUrl;
      }
      const body = { name: f.name.trim(), brand: f.brand.trim(), description: f.description.trim(), category: f.category, price, stock, imageUrl };
      return f.id == null ? api.addPart(body) : api.editPart({ id: f.id, ...body });
    }, f.id == null ? 'Part added.' : 'Part updated.');
    if (ok) setForm(null);
  }

  async function remove(p: Json) {
    const ok = await confirm('Delete Part?', `Delete "${p.name}"? This cannot be undone.`, { confirmText: 'Delete', destructive: true });
    if (ok) run(() => api.deletePart(Number(p.id)), 'Part deleted.');
  }

  const preview = form?.picked?.uri ?? form?.imageUrl;

  return (
    <>
      <ListScreen
        list={list}
        data={data}
        keyOf={(p) => String(p.id)}
        emptyIcon="cog-outline"
        emptyLabel="No parts found."
        onAdd={() => openForm()}
        header={
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search name, brand or category" />
            <FilterChips options={['All', ...categories.map(cap)]} value={cat === 'All' ? 'All' : cap(cat)} onChange={(v) => setCat(v === 'All' ? 'All' : v.toLowerCase())} />
          </>
        }
        renderItem={(p) => {
          const stock = Number(p.stock) || 0;
          return (
            <Card>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: colors.greyLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 72, height: 72 }} contentFit="cover" /> : <Ionicons name="cog-outline" size={28} color={colors.grey} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{p.name}</Text>
                  {p.brand ? <Text numberOfLines={1} style={text.bodySmall}>{p.brand}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <Pill label={cap(String(p.category ?? 'General'))} color={colors.primary} />
                    <Pill label={stock <= 0 ? 'Out of stock' : `${stock} in stock`} color={stock <= 0 ? colors.red : stock <= 5 ? '#ED9E00' : colors.green} />
                  </View>
                </View>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.primary, marginTop: 10 }}>{peso(Number(p.price) || 0)}</Text>
              <CardActions>
                <SmallButton label="Edit" icon="create-outline" tone="primary" disabled={busy} onPress={() => openForm(p)} />
                <SmallButton label="Delete" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(p)} />
              </CardActions>
            </Card>
          );
        }}
      />

      <Sheet visible={form != null} onClose={() => setForm(null)}>
        <Text style={[text.headingSmall, { marginBottom: 16 }]}>{form?.id == null ? 'Add Part' : 'Edit Part'}</Text>

        <Pressable onPress={pickImage} style={{ alignSelf: 'center', marginBottom: 20, alignItems: 'center' }}>
          <View style={{ width: 110, height: 110, borderRadius: 16, backgroundColor: colors.greyLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.greyBorder }}>
            {preview ? <Image source={{ uri: preview }} style={{ width: 110, height: 110 }} contentFit="cover" /> : <Ionicons name="image-outline" size={32} color={colors.grey} />}
          </View>
          <Text style={[text.linkText, { marginTop: 8 }]}>{preview ? 'Change Photo' : 'Add Photo'}</Text>
        </Pressable>

        <Field label="Part Name" value={form?.name ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, name: v })} placeholder="e.g. Brake Pads" error={error} />
        <Field label="Brand" value={form?.brand ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, brand: v })} placeholder="Optional" />
        <Select label="Category" value={form?.category ?? null} options={Array.from(new Set([...categories, form?.category ?? ''])).filter(Boolean).map((c) => ({ value: c, label: cap(c) }))} onChange={(v) => setForm((f) => f && { ...f, category: v })} />
        <Field label="Price (PHP)" value={form?.price ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, price: v.replace(/[^0-9.]/g, '') })} placeholder="0.00" keyboardType="decimal-pad" />
        <Field label="Stock" value={form?.stock ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, stock: v.replace(/[^0-9]/g, '') })} placeholder="0" keyboardType="number-pad" />
        <Field label="Description" value={form?.description ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, description: v })} placeholder="Optional" multiline />
        <PrimaryButton title={form?.id == null ? 'Add Part' : 'Save Changes'} onPress={save} loading={busy} />
      </Sheet>
    </>
  );
}