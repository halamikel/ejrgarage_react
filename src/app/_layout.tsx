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
import { colors } from '@/theme/theme';

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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="(customer)" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="(mechanic)" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="(admin)" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="terms" options={{ headerShown: true, title: 'Terms & Conditions' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
