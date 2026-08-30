import { describe, expect, it } from 'vitest';
import { formatTimestamp } from '@/lib/format';

describe('formatTimestamp', () => {
  it('renders a SQLite UTC timestamp in a readable form', () => {
    expect(formatTimestamp('2026-01-01 09:00:00')).toBe('1 Jan 2026, 09:00 UTC');
  });

  it('reads the stored value as UTC rather than local time', () => {
    // SQLite writes `datetime('now')` with a space separator and no zone marker, so
    // without the T/Z fix-up `Date` would parse it in the machine's zone. A late-evening
    // timestamp is the case that would roll over to the next day if that broke.
    expect(formatTimestamp('2026-06-15 23:30:00')).toBe('15 Jun 2026, 23:30 UTC');
  });

  it('renders midnight without rolling the date backwards', () => {
    expect(formatTimestamp('2026-06-15 00:00:00')).toBe('15 Jun 2026, 00:00 UTC');
  });

  it('pins the locale, so the server environment cannot reorder the date', () => {
    // en-GB puts the day first. Under en-US the same instant would read "Jun 15, 2026".
    expect(formatTimestamp('2026-06-15 12:00:00')).toMatch(/^15 Jun 2026,/);
  });

  it('always marks the output as UTC', () => {
    expect(formatTimestamp('2026-06-15 12:00:00').endsWith(' UTC')).toBe(true);
  });

  it('returns the raw value unchanged when it cannot be parsed', () => {
    // content is rendered from a TEXT column; an unparseable timestamp should degrade to
    // showing the stored string rather than "Invalid Date" or a thrown error.
    expect(formatTimestamp('not a timestamp')).toBe('not a timestamp');
  });

  it('returns an empty string unchanged', () => {
    expect(formatTimestamp('')).toBe('');
  });

  it('accepts only SQLite’s format, passing an ISO string straight through', () => {
    // Documenting the contract rather than a defect: the fix-up appends "Z", so a value
    // that already carries one becomes invalid and falls back to the raw string. Every
    // call site reads from `created_at` / `updated_at`, which are always SQLite-formatted.
    expect(formatTimestamp('2026-01-01T09:00:00Z')).toBe('2026-01-01T09:00:00Z');
  });
});
