import { describe, expect, it } from 'vitest';
import { HEADING_LEVELS, noteExtensions } from '@/lib/tiptap';

type BundledExtension = { name: string; options?: { levels?: number[] } };

/** The extensions StarterKit registers, which is what actually defines the note schema. */
function bundledExtensions(): BundledExtension[] {
  const [starterKit] = noteExtensions();
  const addExtensions = (starterKit as unknown as { config: { addExtensions?: () => unknown[] } })
    .config.addExtensions;

  return (addExtensions?.call(starterKit) ?? []) as BundledExtension[];
}

describe('HEADING_LEVELS', () => {
  it('is H1 to H3, per SPEC.MD §1', () => {
    expect(HEADING_LEVELS).toEqual([1, 2, 3]);
  });
});

describe('noteExtensions', () => {
  it('registers StarterKit alone', () => {
    const extensions = noteExtensions();

    // Passing anything StarterKit already bundles alongside it registers that extension
    // twice and TipTap warns about duplicates.
    expect(extensions).toHaveLength(1);
    expect(extensions[0].name).toBe('starterKit');
  });

  it('configures headings to exactly the levels the toolbar offers', () => {
    const heading = bundledExtensions().find((extension) => extension.name === 'heading');

    expect(heading?.options?.levels).toEqual([...HEADING_LEVELS]);
  });

  it('gives the editor and the read-only viewer identical heading levels', () => {
    // The whole reason this module exists: a viewer built with narrower levels silently
    // drops headings the stored document actually contains.
    const editorHeading = bundledExtensions().find((e) => e.name === 'heading');
    const viewerHeading = bundledExtensions().find((e) => e.name === 'heading');

    expect(editorHeading?.options?.levels).toEqual(viewerHeading?.options?.levels);
  });

  it('registers no extension twice', () => {
    const names = bundledExtensions().map((extension) => extension.name);

    expect(names).toEqual([...new Set(names)]);
  });

  it('already provides every node and mark the toolbar can produce', () => {
    // If StarterKit ever stops bundling one of these, the toolbar button for it goes dead
    // rather than erroring — so the list is asserted rather than assumed.
    const names = new Set(bundledExtensions().map((extension) => extension.name));

    for (const required of [
      'bold',
      'italic',
      'code',
      'codeBlock',
      'bulletList',
      'listItem',
      'heading',
      'horizontalRule',
      'paragraph',
      'doc',
      'text',
      'undoRedo',
    ]) {
      expect(names).toContain(required);
    }
  });
});
