// "Need rescue?" banner for the customer home screen. Tapping it opens a sheet
// with two actions that hand off to the phone's own apps, number pre-filled:
//   - Call for Rescue    -> dialer (tel:)
//   - Message for Rescue -> messaging app (sms:) with a short pre-typed request
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { showAlert } from '@/lib/dialogs';
import { RESCUE_NUMBER, hasRescueNumber, openRescueDialer, openRescueMessage } from '@/lib/rescue';
import { useUserSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';

export function RescueButton() {
  const { user, session } = useUserSession();
  const [open, setOpen] = useState(false);

  async function run(action: () => Promise<void>, what: string) {
    if (!hasRescueNumber) {
      await showAlert('Rescue number not set', 'The rescue hotline has not been configured in this app yet. Please contact the garage another way.');
      return;
    }
    try {
      await action();
      setOpen(false);
    } catch {
      await showAlert(`Could not open ${what}`, `Please ${what === 'the phone app' ? 'dial' : 'text'} ${RESCUE_NUMBER} manually.`);
    }
  }

  function messageBody() {
    const name = session.displayName;
    const phone = String(user?.phone ?? '').trim();
    return `Rescue request - EJR Garage app.\nName: ${name}${phone ? `\nContact: ${phone}` : ''}\nMy location: \nProblem: `;
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Rescue"
        style={{
          marginTop: 20,
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.red,
          gap: 14,
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="warning" size={26} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>Rescue</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.white }}>Broke down? Tap to call or message us.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.white} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text style={text.headingSmall}>Need rescue?</Text>
        <Text style={[text.bodyMedium, { marginTop: 6, marginBottom: 20 }]}>
          {hasRescueNumber ? `Rescue hotline: ${RESCUE_NUMBER}` : 'Rescue hotline is not set up yet.'}
        </Text>

        <Pressable
          onPress={() => run(openRescueDialer, 'the phone app')}
          accessibilityRole="button"
          style={{ height: 56, borderRadius: 12, backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <Ionicons name="call" size={20} color={colors.white} />
          <Text style={text.buttonText}>Call for Rescue</Text>
        </Pressable>

        <Pressable
          onPress={() => run(() => openRescueMessage(messageBody()), 'the messaging app')}
          accessibilityRole="button"
          style={{
            height: 56,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.red,
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.red} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.red }}>Message for Rescue</Text>
        </Pressable>

        <Pressable onPress={() => setOpen(false)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 16 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.greyText }}>Cancel</Text>
        </Pressable>
      </Sheet>
    </>
  );
}
