import { describe, expect, it } from 'vitest';
import { publicNoteUrl, resolveAppOrigin } from '@/lib/share-url';

describe('resolveAppOrigin', () => {
  it('prefers the configured canonical URL over the request Host header', () => {
    expect(resolveAppOrigin('https://notes.example.com', 'evil.test')).toBe(
      'https://notes.example.com',
    );
  });

  it('falls back to the Host header when nothing is configured', () => {
    expect(resolveAppOrigin(undefined, 'localhost:4000')).toBe('http://localhost:4000');
  });

  it('falls back to the dev host when there is no Host header either', () => {
    expect(resolveAppOrigin(undefined, null)).toBe('http://localhost:3000');
  });

  it('strips a trailing slash so the built link has no doubled separator', () => {
    expect(resolveAppOrigin('https://notes.example.com/', null)).toBe('https://notes.example.com');
  });

  it('ignores an empty configured URL rather than returning an empty origin', () => {
    expect(resolveAppOrigin('', 'localhost:3000')).toBe('http://localhost:3000');
  });
});

describe('publicNoteUrl', () => {
  it('builds the absolute /p/<slug> link a reader can paste anywhere', () => {
    expect(publicNoteUrl('https://notes.example.com', 'V1StGXR8Z5jdHi6BmyT')).toBe(
      'https://notes.example.com/p/V1StGXR8Z5jdHi6BmyT',
    );
  });

  it('returns null when the note has no slug, so no link is rendered', () => {
    expect(publicNoteUrl('https://notes.example.com', null)).toBeNull();
  });

  it('returns null for an empty slug rather than a link to the route root', () => {
    expect(publicNoteUrl('https://notes.example.com', '')).toBeNull();
  });
});
