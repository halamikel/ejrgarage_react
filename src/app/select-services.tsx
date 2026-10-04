// Port of lib/screens/customer/booking_screen.dart — step 2 of 3 (choose services).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { PrimaryButton } from '@/components/ui';
import { ApiException, api, type Json } from '@/services/api';
import { bookingDraft } from '@/services/bookingDraft';
import { colors, fonts, text } from '@/theme/theme';

const MAX_SERVICES = 5;

const ELECTRIC_DISABLED = new Set(
  [
    'Change Oil', 'Oil Change', 'Oil Filter Replacement', 'Engine Oil Replacement', 'Engine Tune-Up',
    'Engine Tuning', 'Engine Repair', 'Engine Overhaul', 'Engine Maintenance', 'Carburator Services',
    'Carburetor Services', 'EFI', 'Fuel Injection Service', 'Fuel System Cleaning', 'Decarbonizer',
    'Engine Flush', 'Transmission Fluid Change', 'Transmission Oil Change', 'Auto Electrical Transmission',
  ].map((s) => s.trim().toLowerCase()),
);

const serviceName = (s: Json) => String(s.name ?? s.service_name ?? '').trim();
const serviceCategory = (s: Json) => String(s.category ?? 'General').trim();

function formatPrice(raw: unknown): string {
  const price = parseFloat(String(raw ?? ''));
  if (!(price > 0)) return '';
  const text = Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2);
  const [whole, frac] = text.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `Starts at \u20b1${frac ? `${withCommas}.${frac}` : withCommas}`;
}

export default function SelectServicesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { vehicle } = bookingDraft.get();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<Json[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Json | null>(null);

  const isElectric = (vehicle?.fuel ?? '').trim().toLowerCase() === 'electric';
  const disabledForEv = useCallback((name: string) => isElectric && ELECTRIC_DISABLED.has(name.trim().toLowerCase()), [isElectric]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPublic('get_services.php');
      if (Array.isArray(res.services)) setServices(res.services.filter((s: unknown) => s && typeof s === 'object'));
      else {
        setServices([]);
        setError('No services were returned by the server.');
      }
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not load services. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(name: string) {
    if (disabledForEv(name)) {
      toast('This service is not available for electric vehicles.');
      return;
    }
    if (selected.includes(name)) {
      setSelected((s) => s.filter((n) => n !== name));
      return;
    }
    if (selected.length >= MAX_SERVICES) {
      toast('You may select up to 5 services per booking.');
      return;
    }
    setSelected((s) => [...s, name]);
  }

  function next() {
    if (selected.length === 0) {
      toast('Please select at least one service.');
      return;
    }
    const usable = isElectric ? selected.filter((n) => !disabledForEv(n)) : selected;
    if (usable.length === 0) {
      toast('Please select an available service for your electric vehicle.');
      return;
    }
    bookingDraft.setServices(usable);
    router.push('/booking-confirmation');
  }

  // The draft is in memory only; if the app was reloaded mid-flow, restart.
  if (!vehicle) {
    return (
      <View style={styles.center}>
        <Ionicons name="car-outline" size={40} color={colors.grey} />
        <Text style={[text.bodyMedium, { marginVertical: 12, textAlign: 'center' }]}>Your booking details were lost. Please start again.</Text>
        <PrimaryButton title="Back to Booking" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />;

  if (error || services.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name={error ? 'alert-circle-outline' : 'construct-outline'} size={48} color={error ? colors.red : colors.grey} />
        <Text style={[text.headingSmall, { marginTop: 12 }]}>{error ? 'Could not load services' : 'No services available'}</Text>
        <Text style={[text.bodyMedium, { marginVertical: 8, textAlign: 'center' }]}>{error ?? 'Please try again later.'}</Text>
        <PrimaryButton title="Retry" onPress={load} style={{ alignSelf: 'stretch', marginTop: 8 }} />
      </View>
    );
  }

  const grouped = new Map<string, Json[]>();
  for (const s of services) {
    const cat = serviceCategory(s);
    grouped.set(cat, [...(grouped.get(cat) ?? []), s]);
  }

  const detailName = detail ? serviceName(detail) : '';
  const detailDisabled = detail ? disabledForEv(detailName) : false;
  const detailSelected = selected.includes(detailName);
  const detailDesc = detail ? String(detail.description ?? '').trim() : '';
  const detailPrice = detail ? formatPrice(detail.price_from) : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <Text style={text.bodySmall}>Step 2 of 3</Text>
        <Text style={[text.headingMedium, { fontSize: 22, marginTop: 8 }]}>Choose Your Services</Text>
        <Text style={[text.bodySmall, { fontSize: 13, marginTop: 6, marginBottom: 20 }]}>Select the services you need for your vehicle.</Text>

        <View style={styles.vehicleCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="car-outline" size={18} color={colors.primary} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.grey }}>Your Vehicle</Text>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, marginTop: 6 }}>{`${vehicle.brand} ${vehicle.model}`}</Text>
          <Text style={[text.bodySmall, { marginTop: 2 }]}>{`${vehicle.year} \u2022 ${vehicle.plate} \u2022 ${vehicle.fuel}`}</Text>
        </View>

        {isElectric && (
          <View style={styles.evNotice}>
            <Ionicons name="car-sport-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13 }}>Electric Vehicle</Text>
              <Text style={[text.bodySmall, { marginTop: 2, lineHeight: 18 }]}>
                Some engine, oil, fuel-system, and transmission services are not available for electric vehicles.
              </Text>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20 }}>
          <Text style={text.headingSmall}>Available Services</Text>
          <View style={styles.countPill}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.primary }}>{`${selected.length}/${MAX_SERVICES} selected`}</Text>
          </View>
        </View>

        {[...grouped.entries()].map(([category, items]) => (
          <View key={category} style={{ marginBottom: 12 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, marginBottom: 10 }}>{category}</Text>
            {items.map((s, i) => {
              const name = serviceName(s);
              const disabled = disabledForEv(name);
              const isSel = selected.includes(name);
              const desc = String(s.description ?? '').trim();
              const price = formatPrice(s.price_from);
              return (
                <Pressable
                  key={s.id ?? `${name}-${i}`}
                  onPress={() => toggle(name)}
                  disabled={disabled}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSel, disabled }}
                  style={[styles.card, isSel && { borderColor: colors.primary, backgroundColor: colors.primaryLight }, disabled && { opacity: 0.55 }]}
                >
                  <View style={[styles.check, isSel && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    {isSel ? <Ionicons name="checkmark" size={15} color={colors.white} /> : disabled ? <Ionicons name="lock-closed-outline" size={12} color={colors.grey} /> : null}
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{name}</Text>
                    {desc ? <Text numberOfLines={2} style={[text.bodySmall, { marginTop: 2 }]}>{desc}</Text> : null}
                    {price ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.primary, marginTop: 4 }}>{price}</Text> : null}
                    {disabled && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.red, marginTop: 4 }}>Not available for electric vehicles</Text>}
                  </View>
                  <Pressable onPress={() => setDetail(s)} hitSlop={10} accessibilityLabel="View details">
                    <Ionicons name="information-circle-outline" size={22} color={colors.grey} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.black }}>Back</Text>
          </Pressable>
          <View style={{ flex: 2 }}>
            <PrimaryButton title="Next" onPress={next} disabled={selected.length === 0} />
          </View>
        </View>
      </ScrollView>

      <Sheet visible={detail != null} onClose={() => setDetail(null)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ padding: 10, borderRadius: 12, backgroundColor: colors.primaryLight }}>
            <Ionicons name="construct-outline" size={22} color={colors.primary} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17 }}>{detailName}</Text>
        </View>
        {detailPrice ? <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginTop: 12 }}>{detailPrice}</Text> : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.greyText, marginTop: 14, marginBottom: 20 }}>
          {detailDesc || 'No additional details are available for this service yet. Feel free to ask our team when you arrive.'}
        </Text>
        <Pressable
          disabled={detailDisabled}
          onPress={() => toggle(detailName)}
          style={[
            styles.sheetBtn,
            { backgroundColor: detailDisabled ? colors.greyBorder : detailSelected ? colors.greyLight : colors.primary },
          ]}
        >
          <Text style={{ fontFamily: fonts.bold, color: detailDisabled ? colors.greyText : detailSelected ? colors.primary : colors.white }}>
            {detailDisabled ? 'Not Available For This Vehicle' : detailSelected ? 'Remove From Selection' : 'Select This Service'}
          </Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.white },
  vehicleCard: { padding: 16, borderRadius: 14, backgroundColor: colors.greyLight },
  evNotice: { flexDirection: 'row', gap: 12, padding: 14, marginTop: 16, borderRadius: 14, backgroundColor: colors.primaryLight },
  countPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, backgroundColor: colors.primaryLight },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, borderColor: colors.greyBorder },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.greyBorder, alignItems: 'center', justifyContent: 'center' },
  backBtn: { flex: 1, height: 56, borderRadius: 12, borderWidth: 1, borderColor: colors.greyBorder, alignItems: 'center', justifyContent: 'center' },
  sheetBtn: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
