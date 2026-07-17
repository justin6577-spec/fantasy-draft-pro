import { View, StyleSheet } from 'react-native';
import { AuthForm } from '@/auth/AuthForm';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme/theme';

export default function LoginScreen(): React.JSX.Element {
  const { login } = useAuth();
  return (
    <View style={styles.screen}>
      <AuthForm mode="login" onSubmit={login} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });
