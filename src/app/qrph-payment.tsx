// Port of lib/screens/customer/qrph_payment_screen.dart.
// Polls check_qrph_status.php every 4s while a 30-minute countdown runs.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { confirm } from '@/lib/dialogs';
import { peso } from '@/lib/format';
import { ApiException, api } from '@/services/api';
import { qrphHandoff } from '@/services/qrphHandoff';
import { colors, fonts, text } from '@/theme/theme';

type QrState = 'waiting' | 'paid' | 'expired' | 'error';

export default function QrphPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const initial = qrphHandoff.get(orderId);

  const [qrImage, setQrImage] = useState(initial?.qrImage ?? '');
  const [secondsLeft, setSecondsLeft] = useState(initial?.expiresIn ?? 0);
  const [state, setState] = useState<QrState>(initial ? 'waiting' : 'error');
  const [errorMessage, setErrorMessage] = useState<string | null>(initial ? null : 'Payment details were lost. Check My Orders.');
  const [regenerating, setRegenerating] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const total = initial?.totalPrice ?? 0;

  const stateRef = useRef(state);
  stateRef.current = state;

  // Poll + countdown only while waiting. Re-armed whenever a new QR is generated.
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (state !== 'waiting') return;

    const poll = setInterval(async () => {
      if (stateRef.current !== 'waiting') return;
      try {
        const res = await api.checkQrphStatus(orderId);
        if (res.payment_status === 'paid') setState('paid');
        else if (res.payment_status === 'expired') setState('expired');
      } catch {
        // transient network error: keep polling
      }
    }, 4000);

    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [state, cycle, orderId]);

  // Countdown reached zero while still waiting -> the QR code has expired.
  useEffect(() => {
    if (state === 'waiting' && secondsLeft === 0) setState('expired');
  }, [state, secondsLeft]);

  const confirmCancel = useCallback(async () => {
    const ok = await confirm(
      'Cancel this payment?',
      `Order #${orderId} will stay unpaid. You can come back and pay anytime from My Orders before the QR code expires.`,
      { confirmText: 'Cancel Payment', cancelText: 'Keep Waiting', destructive: true },
    );
    if (ok) router.back();
  }, [orderId, router]);

  // Block Android back while waiting (Flutter: PopScope(canPop: state != waiting)).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stateRef.current === 'waiting') {
        confirmCancel();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [confirmCancel]);

  async function regenerate() {
    setRegenerating(true);
    setErrorMessage(null);
    try {
      const res = await api.regenerateQrphPayment(orderId);
      if (res.status !== 'success') throw new ApiException(res.message ?? 'Could not refresh QR code.');
      setQrImage(String(res.qr_image ?? qrImage));
      setSecondsLeft(Number(res.expires_in ?? 1800));
      setImgFailed(false);
      setState('waiting');
      setCycle((c) => c + 1);
    } catch (e) {
      setState('error');
      setErrorMessage(e instanceof ApiException ? e.message : 'Could not connect to server.');
    } finally {
      setRegenerating(false);
    }
  }

  const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const qrUri = (() => {
    const v = qrImage.trim();
    if (v.startsWith('http') || v.startsWith('data:')) return v;
    return `data:image/png;base64,${v}`;
  })();

  const goOrders = () => router.replace('/my-orders');

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerBackVisible: state !== 'waiting',
          gestureEnabled: state !== 'waiting',
          headerRight: () =>
            state === 'waiting' ? (
              <Pressable onPress={confirmCancel} hitSlop={10}>
                <Text style={{ color: colors.red, fontFamily: fonts.medium }}>Cancel</Text>
              </Pressable>
            ) : null,
        }}
      />

      {state === 'waiting' && (
        <>
          <Text style={[text.headingMedium, { color: colors.primary }]}>{peso(total)}</Text>
          <Text style={[text.bodyMedium, { marginTop: 8, marginBottom: 20, textAlign: 'center' }]}>
            Open your GCash, Maya, or banking app and scan
          </Text>
          <View style={styles.qrBox}>
            {imgFailed ? (
              <Text style={[text.bodyMedium, { textAlign: 'center', padding: 24 }]}>Could not display the QR code.</Text>
            ) : (
              <Image source={{ uri: qrUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" onError={() => setImgFailed(true)} />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={text.bodyMedium}>Waiting for payment · expires in {timeLabel}</Text>
          </View>
          <Text style={[text.bodySmall, { marginTop: 8 }]}>Order #{orderId}</Text>
        </>
      )}

      {state === 'paid' && (
        <>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={48} color={colors.white} />
          </View>
          <Text style={[text.headingSmall, { marginTop: 20 }]}>Payment Successful!</Text>
          <Text style={[text.bodyMedium, { marginTop: 8, marginBottom: 28, textAlign: 'center' }]}>
            Your order #{orderId} is confirmed and paid.
          </Text>
          <Primary title="View My Orders" onPress={goOrders} />
        </>
      )}

      {state === 'expired' && (
        <>
          <Ionicons name="qr-code-outline" size={56} color={colors.grey} />
          <Text style={[text.headingSmall, { marginTop: 16 }]}>QR Code Expired</Text>
          <Text style={[text.bodyMedium, { marginTop: 8, marginBottom: 28, textAlign: 'center' }]}>
            This QR code is no longer valid. Generate a new one to continue paying.
          </Text>
          <Primary title="Generate New QR Code" onPress={regenerate} loading={regenerating} />
          <Pressable onPress={goOrders} style={{ marginTop: 16, padding: 8 }}>
            <Text style={text.linkText}>View My Orders Instead</Text>
          </Pressable>
        </>
      )}

      {state === 'error' && (
        <>
          <Ionicons name="alert-circle-outline" size={48} color={colors.red} />
          <Text style={[text.bodyMedium, { marginVertical: 16, textAlign: 'center' }]}>{errorMessage ?? 'Something went wrong.'}</Text>
          {initial ? (
            <Primary title="Try Again" onPress={regenerate} loading={regenerating} />
          ) : (
            <Primary title="View My Orders" onPress={goOrders} />
          )}
        </>
      )}
    </View>
  );
}

function Primary({ title, onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable style={[styles.btn, loading && { opacity: 0.6 }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={text.buttonText}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrBox: { width: 260, height: 260, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.greyBorder, padding: 8, alignItems: 'center', justifyContent: 'center' },
  checkCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  btn: { alignSelf: 'stretch', height: 56, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
