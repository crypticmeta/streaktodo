import { SignInScreen } from '../src/screens/SignInScreen';

// Auth gate in app/_layout.tsx redirects between this route and (tabs)
// based on AuthProvider state — no manual navigation needed here.
export default function SignInRoute() {
  return <SignInScreen />;
}
