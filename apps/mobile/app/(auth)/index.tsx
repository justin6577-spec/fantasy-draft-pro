import { Redirect } from 'expo-router';

export default function AuthIndex(): React.JSX.Element {
  return <Redirect href="/login" />;
}
