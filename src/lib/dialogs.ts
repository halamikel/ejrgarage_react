// Promise-based dialogs, replacing Flutter's `await showDialog(...)`.
// react-native-web's Alert.alert is a no-op, so use window.alert/confirm there.
import { Alert, Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export function showAlert(title: string, message?: string): Promise<void> {
  if (isWeb) {
    window.alert(message ? `${title}\n\n${message}` : title);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}

/** Resolves true only if the user taps the confirm button. */
export function confirm(
  title: string,
  message: string,
  opts: { confirmText: string; cancelText?: string; destructive?: boolean },
): Promise<boolean> {
  if (isWeb) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: opts.cancelText ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: opts.confirmText, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
