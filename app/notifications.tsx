// Dev-only test surface for the local notification engine. Reachable from
// the Profile screen in __DEV__ builds. Production builds ship without a
// link to it; the route still exists but isn't navigated to.
import { NotificationsScreen } from '../src/screens/NotificationsScreen';

export default NotificationsScreen;
