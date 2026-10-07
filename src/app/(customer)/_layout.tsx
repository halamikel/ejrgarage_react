// Port of the BottomNavigationBar in lib/screens/customer/home_screen.dart.
import { CartButton } from '@/components/CartButton';
import { FeedbackGate } from '@/components/FeedbackGate';
import { useRoleGuard } from '@/lib/RoleGuard';
import { cart } from '@/services/cart';
import { colors, fonts } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? on : off} size={size} color={color} />;
  };

export default function CustomerLayout() {
  useEffect(() => {
    cart.load(); // restore the persisted cart (Flutter: CartService.load())
  }, []);

  const guard = useRoleGuard('customer');
  if (guard) return guard;

  return (
    <>
    <FeedbackGate />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.grey,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -5 },
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen
        name="parts"
        options={{
          title: 'Parts',
          tabBarIcon: icon('build', 'build-outline'),
          // Flutter's "Available Parts" AppBar with the cart badge.
          headerShown: true,
          headerTitle: 'Available Parts',
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 18 },
          headerRight: () => <CartButton />,
        }}
      />
      <Tabs.Screen name="booking" options={{ title: 'Booking', tabBarIcon: icon('book', 'book-outline') }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: icon('chatbubble', 'chatbubble-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
    </>
  );
}
