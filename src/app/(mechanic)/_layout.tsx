// Port of lib/screens/mechanic/widgets/bottom_nav.dart + the polling
// lifecycle in mechanic_main_screen.dart (start on mount, stop on unmount).
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import { useRoleGuard } from '@/lib/RoleGuard';
import { startPolling, stopPolling } from '@/services/notifications';
import { fonts, mechanicColors } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? on : off} size={size} color={color} />;
  };

export default function MechanicLayout() {
  useEffect(() => {
    startPolling();
    return stopPolling;
  }, []);

  const guard = useRoleGuard('mechanic');
  if (guard) return guard;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: mechanicColors.primary,
        tabBarInactiveTintColor: mechanicColors.grey,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: icon('cube', 'cube-outline') }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers', tabBarIcon: icon('people', 'people-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
