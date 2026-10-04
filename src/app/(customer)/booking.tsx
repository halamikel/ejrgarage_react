// Port of lib/screens/customer/booking_details_screen.dart (as a root tab).
// Step 1 of the booking flow: vehicle + date + notes.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerModal, startOfDay, ymd } from '@/components/DatePickerModal';
import { Select } from '@/components/Select';
import { ErrorBanner, Field, PrimaryButton } from '@/components/ui';
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_BRANDS, VEHICLE_MODELS, buildYearList } from '@/lib/vehicleData';
import { api, type Json } from '@/services/api';
import { bookingDraft, type BookingVehicle } from '@/services/bookingDraft';
import { colors, fonts, text } from '@/theme/theme';

const dateKey = (raw: unknown): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw));
  return m ? m[1] : null;
};

export default function BookingDetailsTab() {
  const router = useRouter();
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [savedVehicles, setSavedVehicles] = useState<Json[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [busyDates, setBusyDates] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [transmission, setTransmission] = useState<string | null>(null);
  const [fuel, setFuel] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(buildYearList, []);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getVehicles();
        const list = (res.vehicles as Json[]) ?? [];
        setSavedVehicles(list);
        setUseManualEntry(list.length === 0);
      } catch {
        setUseManualEntry(true);
      } finally {
        setLoadingVehicles(false);
      }
    })();
    (async () => {
      try {
        const res = await api.getBusyDates();
        const keys = ((res.busy_dates as unknown[]) ?? []).map(dateKey).filter((k): k is string => k != null);
        setBusyDates(new Set(keys));
      } catch {
        // busy dates are best-effort
      }
    })();
  }, []);

  const isBusy = (d: Date) => busyDates.has(ymd(d));
  const maxDate = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90), [now]);

  function onBrandChange(b: string) {
    setBrand(b);
    setModel(null);
  }
  function onFuelChange(f: string) {
    setFuel(f);
    if (f === 'Electric' && transmission === 'Manual') setTransmission(null);
  }

  function next() {
    setError(null);
    if (!selectedDate) {
      setError('Please select an appointment date.');
      return;
    }
    const appointmentDate = ymd(selectedDate);
    const notesText = notes.trim();

    let vehicle: BookingVehicle;
    const saved = savedVehicles.find((v) => String(v.id) === savedId);
    if (!useManualEntry && saved) {
      vehicle = {
        brand: String(saved.brand ?? ''),
        model: String(saved.model ?? ''),
        year: String(saved.year_model ?? ''),
        plate: String(saved.plate_number ?? ''),
        transmission: String(saved.transmission ?? ''),
        fuel: String(saved.fuel_type ?? ''),
        appointmentDate,
      };
    } else {
      if (!brand || !model || !model.trim() || !year || !plate.trim() || !transmission || !fuel) {
        setError('Please complete all vehicle details before continuing.');
        return;
      }
      vehicle = { brand, model, year, plate: plate.trim(), transmission, fuel, appointmentDate };
    }
    bookingDraft.setDetails(vehicle, notesText);
    router.push('/select-services');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      {loadingVehicles ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={[text.bodySmall, { marginBottom: 16 }]}>Vehicle Details</Text>
          <ErrorBanner message={error} />

          {savedVehicles.length > 0 && (
            <>
              <Text style={[text.label, { marginBottom: 8 }]}>Select from Your Garage</Text>
              {!useManualEntry ? (
                <>
                  <Select
                    value={savedId}
                    placeholder="-- Choose a saved vehicle --"
                    options={savedVehicles.map((v) => ({
                      value: String(v.id),
                      label: `${v.brand} ${v.model} (${v.plate_number})`,
                    }))}
                    onChange={setSavedId}
                  />
                  <LinkButton
                    icon="add-circle-outline"
                    label="Add a vehicle"
                    onPress={() => {
                      setUseManualEntry(true);
                      setSavedId(null);
                    }}
                  />
                </>
              ) : (
                <LinkButton icon="arrow-back" label="Back to my garage" onPress={() => setUseManualEntry(false)} />
              )}
            </>
          )}

          {useManualEntry && (
            <>
              <Text style={[text.headingSmall, { fontSize: 16, marginTop: 8 }]}>Vehicle Information</Text>
              <Text style={[text.bodySmall, { marginTop: 4, marginBottom: 16 }]}>
                Select your vehicle brand, model, year, transmission and fuel type.
              </Text>
              <Select testID="booking_brand_dropdown" label="Car Brand" value={brand} options={VEHICLE_BRANDS} onChange={onBrandChange} />
              <Select
                testID="booking_model_dropdown"
                label="Car Model"
                value={model}
                options={brand ? (VEHICLE_MODELS[brand] ?? []) : []}
                disabled={!brand}
                placeholder={brand ? 'Select car model' : 'Select a car brand first'}
                onChange={setModel}
              />
              <Select testID="booking_year_dropdown" label="Year Model" value={year} options={years} placeholder="Select year model" onChange={setYear} />
              <Field
                label="Plate Number"
                placeholder="e.g. ABC 1234"
                value={plate}
                onChangeText={setPlate}
                autoCapitalize="characters"
                testID="booking_plate_field"
              />
              <Select
                testID="booking_transmission_dropdown"
                label="Transmission"
                value={transmission}
                options={fuel === 'Electric' ? ['Automatic'] : TRANSMISSIONS}
                onChange={setTransmission}
              />
              <Select testID="booking_fuel_dropdown" label="Fuel Type" value={fuel} options={FUEL_TYPES} onChange={onFuelChange} />
              {fuel === 'Electric' && (
                <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.primaryLight, marginBottom: 20 }}>
                  <Ionicons name="car-sport-outline" size={20} color={colors.primary} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.greyText, lineHeight: 18 }}>
                    Electric vehicle selected. Only services applicable to electric vehicles will be available on the next step.
                  </Text>
                </View>
              )}
            </>
          )}

          <Text style={[text.headingSmall, { fontSize: 16, marginTop: 8, marginBottom: 8 }]}>Appointment Date</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Appointment date"
            style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16 }}
          >
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: selectedDate ? colors.black : colors.grey }}>
              {selectedDate ? ymd(selectedDate) : 'Select a date...'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={colors.grey} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 24 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red }} />
            <Text style={text.bodySmall}>Fully booked dates are disabled</Text>
          </View>

          <Text style={[text.headingSmall, { fontSize: 16, marginBottom: 8 }]}>Additional Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholder="Enter any special requests or issues with your vehicle..."
            placeholderTextColor={colors.grey}
            style={{
              minHeight: 100,
              textAlignVertical: 'top',
              borderWidth: 1,
              borderColor: colors.greyBorder,
              borderRadius: 12,
              padding: 16,
              fontSize: 14,
              fontFamily: fonts.regular,
              color: colors.black,
              marginBottom: 32,
            }}
          />

          <PrimaryButton title="Next" onPress={next} />
        </ScrollView>
      )}

      <DatePickerModal
        visible={pickerOpen}
        value={selectedDate}
        minDate={startOfDay(now)}
        maxDate={maxDate}
        isDisabled={isBusy}
        onSelect={setSelectedDate}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

function LinkButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 12 }}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={text.linkText}>{label}</Text>
    </Pressable>
  );
}
