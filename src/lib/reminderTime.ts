/** Pure, timezone-aware reminder fire-time calculation. */
export const DEFAULT_REMINDER_TIME_MINUTES = 9 * 60;

export function computeReminderFireAt(args: {
  dueAt: number | null;
  dueTime: number | null;
  leadMinutes: number;
  nowTs?: number;
}): number | null {
  if (args.dueAt === null) return null;
  const minutes = args.dueTime ?? DEFAULT_REMINDER_TIME_MINUTES;
  const local = new Date(args.dueAt);
  local.setHours(0, minutes - args.leadMinutes, 0, 0);
  const fire = local.getTime();
  if (fire <= (args.nowTs ?? Date.now())) return null;
  return fire;
}
