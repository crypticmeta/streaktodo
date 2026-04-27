/**
 * In-memory pub/sub for DB mutations. Lets multiple `useTasks` /
 * `useCategories` instances across the app refresh when *any* mutation
 * happens, regardless of which screen made the change.
 *
 * Zero dependencies. We deliberately don't reach for a state library — the
 * surface is small, every screen already owns a query loop, and bouncing
 * "something changed" through this bus keeps each screen's data flow
 * obvious without a global store.
 */

export type DbEvent =
  | 'tasks-changed'
  | 'categories-changed';

type Listener = () => void;

const listeners: Map<DbEvent, Set<Listener>> = new Map();

export function emit(event: DbEvent): void {
  const subs = listeners.get(event);
  if (!subs) return;
  // Snapshot so a listener that unsubscribes itself during dispatch doesn't
  // mutate the iteration target.
  for (const fn of [...subs]) {
    try {
      fn();
    } catch {
      // Listener errors must not break the dispatch loop.
    }
  }
}

export function subscribe(event: DbEvent, fn: Listener): () => void {
  let subs = listeners.get(event);
  if (!subs) {
    subs = new Set();
    listeners.set(event, subs);
  }
  subs.add(fn);
  return () => {
    subs!.delete(fn);
  };
}
