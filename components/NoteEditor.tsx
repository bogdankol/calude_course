'use client';

import type { JSX, ReactNode } from 'react';
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from '@tiptap/react';
import { HEADING_LEVELS, noteExtensions } from '@/lib/tiptap';

type NoteEditorProps = {
  /**
   * Fires on every document change with the current TipTap JSON. Keep the identity
   * stable (a `useCallback` writing into a ref) — a new function each render would
   * re-run the editor's option sync for nothing.
   */
  onChange: (doc: JSONContent) => void;
  /** Id of the element labelling the editor, since a contenteditable has no `<label>`. */
  labelledBy: string;
  /** Document to open with. Omit for a blank note. */
  initialDoc?: JSONContent;
  disabled?: boolean;
};

/**
 * TipTap rich-text editor for a note body, with the SPEC.MD §9.2 toolbar.
 *
 * Extensions come from `lib/tiptap.ts` so this and the read-only `NoteContent` can never
 * disagree about the schema.
 */
export function NoteEditor({
  onChange,
  labelledBy,
  initialDoc,
  disabled = false,
}: NoteEditorProps): JSX.Element {
  const editor = useEditor({
    extensions: noteExtensions(),
    content: initialDoc,
    editable: !disabled,
    // Required under the App Router. TipTap v3 defaults this to `true`, which throws
    // "SSR has been detected" and risks a hydration mismatch when the client component
    // is server-rendered on the first pass. The cost is that `editor` is null until
    // hydration finishes, hence the placeholder below.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-content min-h-72 px-4 py-3 focus:outline-none',
        'aria-labelledby': labelledBy,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  if (!editor) {
    // Same box, same height, so hydration does not shift the page.
    return (
      <div className='overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]'>
        <div className='h-12 border-b border-white/10 bg-white/[0.02]' />
        <div className='min-h-72 px-4 py-3 text-sm text-neutral-600'>Loading editor…</div>
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] transition-colors focus-within:border-slate-500'>
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * The toolbar never server-renders — `NoteEditor` returns the placeholder while `editor`
 * is null — so reading `navigator` here is safe and cannot cause a hydration mismatch.
 */
function modifierKey(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }): JSX.Element {
  const mod = modifierKey();

  // Read through `useEditorState` rather than calling `editor.isActive()` in render.
  // v3 defaults `shouldRerenderOnTransaction` to false, so the component is NOT
  // re-rendered per transaction — inline `isActive` checks would render once and then
  // never update as the caret moves.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      paragraph: editor.isActive('paragraph'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      code: editor.isActive('code'),
      bulletList: editor.isActive('bulletList'),
      codeBlock: editor.isActive('codeBlock'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const headingActive: Record<number, boolean> = { 1: state.h1, 2: state.h2, 3: state.h3 };

  return (
    <div
      role='toolbar'
      aria-label='Formatting'
      aria-orientation='horizontal'
      className='flex flex-wrap items-center gap-1 border-b border-white/10 bg-white/[0.02] px-2 py-1.5'
    >
      {/* Text style — one click to any of the four block types SPEC.MD §9.2 lists. */}
      <div
        role='group'
        aria-label='Text style'
        className='flex items-center gap-0.5 rounded-md bg-black/20 p-0.5'
      >
        <StyleButton
          active={state.paragraph}
          disabled={disabled}
          label='Normal text'
          shortcut={`${mod}+Alt+0`}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          Normal
        </StyleButton>

        {HEADING_LEVELS.map((level) => (
          <StyleButton
            key={level}
            active={headingActive[level]}
            disabled={disabled}
            label={`Heading ${level}`}
            shortcut={`${mod}+Alt+${level}`}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            H{level}
          </StyleButton>
        ))}
      </div>

      <Divider />

      <ToolbarButton
        label='Bold'
        shortcut={`${mod}+B`}
        active={state.bold}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className='text-[15px] font-bold'>B</span>
      </ToolbarButton>

      <ToolbarButton
        label='Italic'
        shortcut={`${mod}+I`}
        active={state.italic}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className='font-serif text-[15px] italic'>I</span>
      </ToolbarButton>

      <ToolbarButton
        label='Inline code'
        shortcut={`${mod}+E`}
        active={state.code}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label='Bullet list'
        shortcut={`${mod}+Shift+8`}
        active={state.bulletList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <BulletListIcon />
      </ToolbarButton>

      <ToolbarButton
        label='Code block'
        shortcut={`${mod}+Alt+C`}
        active={state.codeBlock}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeBlockIcon />
      </ToolbarButton>

      {/* Not a toggle — it inserts a node, so there is no active state to show. */}
      <ToolbarButton
        label='Horizontal rule'
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <RuleIcon />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label='Undo'
        shortcut={`${mod}+Z`}
        disabled={disabled || !state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <UndoIcon />
      </ToolbarButton>

      <ToolbarButton
        label='Redo'
        shortcut={`${mod}+Shift+Z`}
        disabled={disabled || !state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <RedoIcon />
      </ToolbarButton>
    </div>
  );
}

function Divider(): JSX.Element {
  return <span aria-hidden className='mx-0.5 h-6 w-px shrink-0 bg-white/10' />;
}

/** `title` and `aria-label` both carry the shortcut, so it is discoverable either way. */
function describe(label: string, shortcut?: string): string {
  return shortcut ? `${label} (${shortcut})` : label;
}

type ButtonBaseProps = {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
};

function StyleButton({
  label,
  shortcut,
  onClick,
  children,
  active = false,
  disabled = false,
}: ButtonBaseProps): JSX.Element {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      title={describe(label, shortcut)}
      aria-label={describe(label, shortcut)}
      aria-pressed={active}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'bg-slate-600 text-white'
          : 'text-neutral-400 hover:bg-white/10 hover:text-neutral-100'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarButton({
  label,
  shortcut,
  onClick,
  children,
  active = false,
  disabled = false,
}: ButtonBaseProps): JSX.Element {
  return (
    <button
      // Without this the button defaults to type="submit" and every format click
      // would post the form.
      type='button'
      onClick={onClick}
      disabled={disabled}
      title={describe(label, shortcut)}
      aria-label={describe(label, shortcut)}
      aria-pressed={active}
      className={`grid size-8 shrink-0 place-items-center rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'bg-slate-600 text-white'
          : 'text-neutral-400 hover:bg-white/10 hover:text-neutral-100'
      }`}
    >
      {children}
    </button>
  );
}

/*
 * Inline SVGs rather than an icon dependency. `aria-hidden` throughout — each button's
 * own `aria-label` is its accessible name.
 */

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function CodeIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <polyline points='16 18 22 12 16 6' />
      <polyline points='8 6 2 12 8 18' />
    </svg>
  );
}

function CodeBlockIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x='3' y='4' width='18' height='16' rx='2' />
      <polyline points='9 10 7 12 9 14' />
      <polyline points='15 10 17 12 15 14' />
    </svg>
  );
}

function BulletListIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <line x1='9' y1='6' x2='20' y2='6' />
      <line x1='9' y1='12' x2='20' y2='12' />
      <line x1='9' y1='18' x2='20' y2='18' />
      <circle cx='4.5' cy='6' r='1.2' fill='currentColor' stroke='none' />
      <circle cx='4.5' cy='12' r='1.2' fill='currentColor' stroke='none' />
      <circle cx='4.5' cy='18' r='1.2' fill='currentColor' stroke='none' />
    </svg>
  );
}

function RuleIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <line x1='3' y1='12' x2='21' y2='12' />
      <line x1='6' y1='6' x2='18' y2='6' opacity='0.35' />
      <line x1='6' y1='18' x2='18' y2='18' opacity='0.35' />
    </svg>
  );
}

function UndoIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d='M3 7v6h6' />
      <path d='M3 13a9 9 0 1 0 3-7.7L3 8' />
    </svg>
  );
}

function RedoIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d='M21 7v6h-6' />
      <path d='M21 13a9 9 0 1 1-3-7.7L21 8' />
    </svg>
  );
}
