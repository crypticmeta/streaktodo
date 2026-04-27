// Epoch milliseconds. SQLite gets these as INTEGER columns —
// trivial to compare/sort, trivial to serialize for backup/sync.
export function now(): number {
  return Date.now();
}
