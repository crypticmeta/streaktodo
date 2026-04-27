import * as Crypto from 'expo-crypto';

// Stable string IDs for every row. UUID v4 is fine for offline-first;
// no central authority is needed and collision probability is negligible.
export function newId(): string {
  return Crypto.randomUUID();
}
