// Port of lib/theme/app_theme.dart (+ lib/screens/mechanic/core/colors.dart).
import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#ED5B1C',
  primaryLight: '#FFF0E8',
  white: '#FFFFFF',
  black: '#000000',
  grey: '#9C9C9C',
  greyLight: '#F5F5F5',
  greyBorder: '#E0E0E0',
  greyText: '#757575',
  splashBg: '#FDE8DC',
  splashBgLight: '#FEF3EC',
  green: '#4CAF50',
  blue: '#2196F3',
  red: '#F44336',
  statusPending: '#ED5B1C',
  statusCompleted: '#4CAF50',
  statusInProgress: '#2196F3',
} as const;

// The mechanic area used its own slightly different palette in Flutter.
export const mechanicColors = {
  primary: '#FF7A00',
  darkOrange: '#E56700',
  black: '#1A1A1A',
  background: '#F8F9FB',
  white: '#FFFFFF',
  grey: '#9CA3AF',
  border: '#E5E7EB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const;

// Font family names registered in src/app/_layout.tsx. With custom fonts on
// RN you pick the weight via the family name, not `fontWeight`.
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const text = StyleSheet.create({
  headingLarge: { fontFamily: fonts.bold, fontSize: 28, color: colors.black, letterSpacing: -0.5 },
  headingMedium: { fontFamily: fonts.bold, fontSize: 24, color: colors.black, letterSpacing: -0.3 },
  headingSmall: { fontFamily: fonts.semibold, fontSize: 20, color: colors.black },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 16, color: colors.black },
  bodyMedium: { fontFamily: fonts.regular, fontSize: 14, color: colors.greyText },
  bodySmall: { fontFamily: fonts.regular, fontSize: 12, color: colors.grey },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.black },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.red },
});
