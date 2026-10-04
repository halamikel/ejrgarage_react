// Stand-in for Flutter's ScaffoldMessenger.showSnackBar.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme/theme';

type ToastKind = 'default' | 'success' | 'error';
type ShowToast = (message: string, kind?: ToastKind, durationMs?: number) => void;

const ToastContext = createContext<ShowToast>(() => {});
export const useToast = () => useContext(ToastContext);

const BG: Record<ToastKind, string> = { default: '#323232', success: colors.green, error: colors.red };

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);

  const show = useCallback<ShowToast>(
    (message, kind = 'default', durationMs = 2500) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, kind });
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, durationMs);
    },
    [opacity],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { bottom: insets.bottom + 72, opacity, backgroundColor: BG[toast.kind] }]}
        >
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: 16, right: 16, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, zIndex: 100 },
  text: { color: colors.white, fontFamily: fonts.regular, fontSize: 14 },
});
