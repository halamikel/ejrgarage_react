import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initNotifications } from '@/services/notifications';
import { ToastProvider } from '@/components/Toast';
import { colors, fonts } from '@/theme/theme';

// Shared AppBar look for screens pushed on top of the role areas (Flutter's
// centered 18px/w600 AppBar title, no elevation).
const pushed = (title: string) => ({
  headerShown: true,
  title,
  headerTitleAlign: 'center' as const,
  headerShadowVisible: false,
  headerTintColor: colors.black,
  headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 18 },
});

// Keep the native splash up until the fonts are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    initNotifications();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(customer)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="(mechanic)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="(admin)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="terms" options={pushed('Terms & Conditions')} />
            <Stack.Screen name="cart" options={pushed('My Cart')} />
            <Stack.Screen name="my-orders" options={pushed('My Orders')} />
            <Stack.Screen name="my-inquiries" options={pushed('My Inquiries')} />
            <Stack.Screen name="my-vehicles" options={pushed('My Vehicles')} />
            <Stack.Screen name="appointments" options={pushed('Appointment')} />
            <Stack.Screen name="select-services" options={pushed('Select Services')} />
            <Stack.Screen name="booking-confirmation" options={pushed('Confirm Booking')} />
            <Stack.Screen name="qrph-payment" options={pushed('Pay with QR Ph')} />
          </Stack>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
