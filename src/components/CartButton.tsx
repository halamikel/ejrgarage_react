// The cart icon + quantity badge from available_parts_screen.dart's AppBar.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useCart } from '@/services/cart';
import { colors, fonts } from '@/theme/theme';

export function CartButton() {
  const router = useRouter();
  const { totalQty } = useCart();
  return (
    <Pressable onPress={() => router.push('/cart')} hitSlop={10} accessibilityLabel="Open cart" style={{ marginRight: 12 }}>
      <Ionicons name="cart-outline" size={26} color={colors.black} />
      {totalQty > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            paddingHorizontal: 3,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.white, fontSize: 10, fontFamily: fonts.bold }}>{totalQty}</Text>
        </View>
      )}
    </Pressable>
  );
}
