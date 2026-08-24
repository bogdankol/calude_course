/**
 * Formats a SQLite timestamp for display.
 *
 * SQLite writes `datetime('now')` as UTC with a space separator, not ISO-8601, so it needs
 * the `T` and the `Z` before `Date` will parse it as UTC rather than local time.
 *
 * The locale and time zone are pinned: this runs in a server component, so leaving them
 * to the environment would make the rendered output depend on the machine.
 */
export function formatTimestamp(sqliteUtc: string): string {
  const date = new Date(sqliteUtc.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return sqliteUtc;

  const formatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);

  return formatted + ' UTC';
}
