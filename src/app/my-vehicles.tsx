import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { ApiException, api, type Json } from '@/services/api';
import { INSPECTION_COMPONENTS, colorForScore, getVehicleHealthHistory, labelForScore, vehicleHealthKey, type VehicleHealthInspection } from '@/services/vehicleHealth';
import { colors, fonts, text } from '@/theme/theme';

const vehicleName = (v: Json) => [v.brand, v.model, v.year_model].filter(Boolean).join(' ') || 'Vehicle';
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function MyVehicles() {
  const [vehicles, setVehicles] = useState<Json[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Json | null>(null);
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try { setVehicles(((await api.getVehicles()).vehicles as Json[]) ?? []); }
    catch (e) { setError(e instanceof ApiException ? e.message : 'Could not load your vehicles.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  return <>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}>
      <Text style={text.bodyMedium}>Health scores summarize the latest mechanic inspection. They are maintenance indicators, not a diagnostic report.</Text>
      {error ? <View style={styles.error}><Text style={[text.bodyMedium, { color: colors.red }]}>{error}</Text><Pressable onPress={() => load()}><Text style={text.linkText}>Try again</Text></Pressable></View> : vehicles.length === 0 ? <View style={styles.empty}><Ionicons name="car-outline" size={42} color={colors.grey} /><Text style={[text.headingSmall, { marginTop: 12 }]}>No vehicles yet</Text><Text style={[text.bodyMedium, { textAlign: 'center', marginTop: 6 }]}>Add a vehicle while booking a service to see its health history here.</Text></View> : <View style={{ gap: 14, marginTop: 18 }}>{vehicles.map((v) => <VehicleCard key={String(v.id ?? v.plate_number)} vehicle={v} onPress={() => setSelected(v)} />)}</View>}
    </ScrollView>
    <VehicleHealthSheet vehicle={selected} onClose={() => setSelected(null)} />
  </>;
}

function VehicleCard({ vehicle, onPress }: { vehicle: Json; onPress: () => void }) {
  const [latest, setLatest] = useState<VehicleHealthInspection | null | undefined>();
  useFocusEffect(useCallback(() => { let active = true; getVehicleHealthHistory(vehicleHealthKey(vehicle)).then((items) => active && setLatest(items[0] ?? null)); return () => { active = false; }; }, [vehicle]));
  const scoreColor = latest ? colorForScore(latest.score) : colors.grey;
  return <Pressable style={styles.card} onPress={onPress} accessibilityLabel={`View health details for ${vehicleName(vehicle)}`}>
    <View style={styles.cardTop}><View style={styles.carIcon}><Ionicons name="car-sport-outline" size={25} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 16 }}>{vehicleName(vehicle)}</Text><Text style={text.bodySmall}>{vehicle.plate_number || 'No plate number'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.grey} /></View>
    <View style={styles.divider} />
    {latest === undefined ? <ActivityIndicator color={colors.primary} /> : latest ? <View style={styles.healthRow}><View><Text style={text.bodySmall}>VEHICLE HEALTH</Text><Text style={{ fontFamily: fonts.semibold, color: scoreColor, fontSize: 14, marginTop: 2 }}>{labelForScore(latest.score)}</Text><Text style={text.bodySmall}>Inspected {date(latest.createdAt)}</Text></View><Text style={[styles.score, { color: scoreColor }]}>{latest.score}%</Text></View> : <Text style={text.bodyMedium}>No inspection has been submitted yet.</Text>}
  </Pressable>;
}

function VehicleHealthSheet({ vehicle, onClose }: { vehicle: Json | null; onClose: () => void }) {
  const [history, setHistory] = useState<VehicleHealthInspection[] | null>(null);
  const [detail, setDetail] = useState<VehicleHealthInspection | null>(null);
  const key = vehicle ? vehicleHealthKey(vehicle) : '';
  useFocusEffect(useCallback(() => { setHistory(null); setDetail(null); if (!key) return; let active = true; getVehicleHealthHistory(key).then((items) => { if (active) { setHistory(items); setDetail(items[0] ?? null); } }); return () => { active = false; }; }, [key]));
  const previous = history && history.length > 1 ? history[1] : null;
  const change = detail && previous ? detail.score - previous.score : null;
  return <Sheet visible={vehicle != null} onClose={onClose}>{vehicle && <>
    <Text style={text.headingSmall}>{vehicleName(vehicle)}</Text><Text style={[text.bodySmall, { marginBottom: 18 }]}>{vehicle.plate_number || 'Vehicle health details'}</Text>
    {history == null ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} /> : !detail ? <Text style={text.bodyMedium}>No mechanic inspection has been submitted for this vehicle yet.</Text> : <>
      <View style={[styles.scorePanel, { borderColor: `${colorForScore(detail.score)}55` }]}><Text style={text.bodySmall}>LATEST VEHICLE HEALTH</Text><Text style={[styles.scoreLarge, { color: colorForScore(detail.score) }]}>{detail.score}%</Text><Text style={{ fontFamily: fonts.semibold, color: colorForScore(detail.score) }}>{labelForScore(detail.score)}</Text><Text style={[text.bodySmall, { marginTop: 4 }]}>Inspected {date(detail.createdAt)}</Text></View>
      {change != null && <View style={styles.change}><Ionicons name={change >= 0 ? 'trending-up-outline' : 'trending-down-outline'} size={19} color={change >= 0 ? colors.green : colors.red} /><Text style={[text.bodyMedium, { flex: 1 }]}>{`Previous: ${previous!.score}%   Current: ${detail.score}%`}</Text><Text style={{ fontFamily: fonts.semibold, color: change >= 0 ? colors.green : colors.red }}>{`${change >= 0 ? '+' : ''}${change}%`}</Text></View>}
      <Text style={[text.headingSmall, { fontSize: 16, marginTop: 22, marginBottom: 8 }]}>Inspection details</Text>
      {INSPECTION_COMPONENTS.map((component) => <View key={component} style={styles.component}><View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.medium, fontSize: 14 }}>{component}</Text>{detail.notes[component] ? <Text style={[text.bodySmall, { marginTop: 2 }]}>{detail.notes[component]}</Text> : null}</View><ConditionPill condition={detail.results[component]} /></View>)}
      {detail.recommendations.length > 0 && <><Text style={[text.headingSmall, { fontSize: 16, marginTop: 22, marginBottom: 8 }]}>Recommended maintenance</Text><View style={styles.recommendations}>{detail.recommendations.map((r) => <View key={r} style={styles.recommendation}><Ionicons name="construct-outline" size={17} color={colors.primary} /><Text style={[text.bodyMedium, { flex: 1 }]}>{r}</Text></View>)}</View></>}
      <Text style={[text.headingSmall, { fontSize: 16, marginTop: 22, marginBottom: 8 }]}>Health history</Text>{history.map((item) => <View key={item.id} style={styles.history}><Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14 }}>{date(item.createdAt)}</Text><Text style={text.bodySmall}>{labelForScore(item.score)}</Text><Text style={[styles.historyScore, { color: colorForScore(item.score) }]}>{item.score}%</Text></View>)}
    </>}
  </>}</Sheet>;
}

function ConditionPill({ condition }: { condition: string }) { const color = condition === 'Good' ? colors.green : condition === 'Needs Attention' ? '#D97706' : colors.red; return <View style={[styles.condition, { backgroundColor: `${color}18` }]}><Text style={{ fontFamily: fonts.semibold, fontSize: 11, color }}>{condition}</Text></View>; }

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 36 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, error: { marginTop: 18, padding: 14, backgroundColor: '#FDEEEE', borderRadius: 12, gap: 8 }, empty: { marginTop: 32, backgroundColor: colors.greyLight, padding: 28, borderRadius: 16, alignItems: 'center' }, card: { borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 16, padding: 16, backgroundColor: colors.white }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, carIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, divider: { height: 1, backgroundColor: colors.greyLight, marginVertical: 14 }, healthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, score: { fontFamily: fonts.bold, fontSize: 30 }, scorePanel: { alignItems: 'center', backgroundColor: colors.greyLight, borderRadius: 16, borderWidth: 1, padding: 18 }, scoreLarge: { fontFamily: fonts.bold, fontSize: 48, marginVertical: 2 }, change: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primaryLight, borderRadius: 12, padding: 12, marginTop: 12 }, component: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.greyLight }, condition: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }, recommendations: { gap: 8 }, recommendation: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: colors.primaryLight }, history: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.greyLight }, historyScore: { fontFamily: fonts.bold, fontSize: 17, minWidth: 46, textAlign: 'right' },
});
