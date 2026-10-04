// Port of lib/screens/get_started_screen.dart.
import { Link, useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { colors, text } from '@/theme/theme';

export default function GetStartedScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={require('../../assets/images/EJRgarage_logoo.png')}
            style={{ width: 220, height: 220 }}
            resizeMode="contain"
          />
          <Text style={[text.headingLarge, { marginTop: 48, textAlign: 'center' }]}>Let's Get Started</Text>
          <Text style={[text.bodyMedium, { marginTop: 16, textAlign: 'center', lineHeight: 21 }]}>
            At EJR Garage, we take pride in delivering dependable automotive solutions for all types of vehicles.
          </Text>
        </View>

        <PrimaryButton title="Sign Up" onPress={() => router.push('/signup')} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, marginBottom: 32 }}>
          <Text style={[text.bodyMedium, { color: colors.grey }]}>Already have an account? </Text>
          <Link href="/login" style={text.linkText}>
            Log In
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
