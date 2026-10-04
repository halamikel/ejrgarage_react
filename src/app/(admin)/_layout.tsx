// Port of lib/screens/admin/admin_drawer.dart (menu entries + order).
import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import { useRoleGuard } from '@/lib/RoleGuard';
import { colors, fonts } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ITEMS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Dashboard', icon: 'grid-outline' },
  { name: 'appointments', title: 'Appointments', icon: 'calendar-outline' },
  { name: 'users', title: 'Users', icon: 'people-outline' },
  { name: 'vehicles', title: 'Vehicles', icon: 'car-outline' },
  { name: 'history', title: 'Service History', icon: 'time-outline' },
  { name: 'parts', title: 'Parts', icon: 'build-outline' },
  { name: 'inquiries', title: 'Part Inquiries', icon: 'mail-outline' },
  { name: 'orders', title: 'Orders', icon: 'cart-outline' },
  { name: 'services', title: 'Services', icon: 'construct-outline' },
  { name: 'mechanics', title: 'Mechanics', icon: 'hammer-outline' },
  { name: 'busy-dates', title: 'Busy Dates', icon: 'calendar-clear-outline' },
  { name: 'live-chat', title: 'Live Chat', icon: 'chatbubble-outline' },
  { name: 'account', title: 'My Account', icon: 'person-outline' },
];

export default function AdminLayout() {
  const guard = useRoleGuard('admin');
  if (guard) return guard;

  return (
    <Drawer
      screenOptions={{
        headerTintColor: colors.black,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 18 },
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: colors.primaryLight,
        drawerLabelStyle: { fontFamily: fonts.medium },
      }}
    >
      {ITEMS.map((i) => (
        <Drawer.Screen
          key={i.name}
          name={i.name}
          options={{
            title: i.title,
            drawerIcon: ({ color, size }) => <Ionicons name={i.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Drawer>
  );
}
