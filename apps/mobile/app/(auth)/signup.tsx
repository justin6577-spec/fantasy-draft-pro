import { View, StyleSheet } from 'react-native';
import { AuthForm } from '@/auth/AuthForm';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme/theme';

export default function SignupScreen(): React.JSX.Element {
  const { signup } = useAuth();
  return (
    <View style={styles.screen}>
      <AuthForm mode="signup" onSubmit={signup} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });
