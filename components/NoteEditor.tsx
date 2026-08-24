"use client";

import type { JSX, ReactNode } from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type NoteEditorProps = {
  /**
   * Fires on every document change with the current TipTap JSON. Keep the identity
   * stable (a `useCallback` writing into a ref) — a new function each render would
   * re-run the editor's option sync for nothing.
   */
  onChange: (doc: JSONContent) => void;
  /** Id of the element labelling the editor, since a contenteditable has no `<label>`. */
  labelledBy: string;
  disabled?: boolean;
};

/**
 * TipTap rich-text editor for a note body.
 *
 * `StarterKit` alone covers everything the toolbar exposes: v3 already bundles Code,
 * CodeBlock, Link, Underline and the list extensions, so importing those separately
 * would register them twice and TipTap would warn about the duplicates.
 */
export function NoteEditor({
  onChange,
  labelledBy,
  disabled = false,
}: NoteEditorProps): JSX.Element {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // The note title is the page's h1, so the body starts a level down.
        heading: { levels: [2, 3] },
      }),
    ],
    editable: !disabled,
    // Required under the App Router. TipTap v3 defaults this to `true`, which throws
    // "SSR has been detected" and risks a hydration mismatch when the client component
    // is server-rendered on the first pass. The cost is that `editor` is null until
    // hydration finishes, hence the placeholder below.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-72 px-4 py-3 focus:outline-none",
        "aria-labelledby": labelledBy,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  if (!editor) {
    // Same box, same height, so hydration doesn't shift the page.
    return (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="h-11 border-b border-white/10 bg-white/[0.02]" />
        <div className="min-h-72 px-4 py-3 text-sm text-neutral-600">Loading editor…</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] transition-colors focus-within:border-slate-500">
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }): JSX.Element {
  // Read through `useEditorState` rather than calling `editor.isActive()` in render.
  // v3 defaults `shouldRerenderOnTransaction` to false, so the component is NOT
  // re-rendered per transaction — inline `isActive` checks would render once and then
  // never update as the caret moves.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      codeBlock: editor.isActive("codeBlock"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      className="flex flex-wrap items-center gap-0.5 border-b border-white/10 bg-white/[0.02] px-2 py-1.5"
    >
      <ToolbarButton
        label="Bold"
        active={state.bold}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolbarButton>

      <ToolbarButton
        label="Italic"
        active={state.italic}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-serif italic">I</span>
      </ToolbarButton>

      <ToolbarButton
        label="Strikethrough"
        active={state.strike}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarButton>

      <ToolbarButton
        label="Inline code"
        active={state.code}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="font-mono text-xs">{"<>"}</span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Heading 2"
        active={state.h2}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>

      <ToolbarButton
        label="Heading 3"
        active={state.h3}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bullet list"
        active={state.bulletList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarButton>

      <ToolbarButton
        label="Numbered list"
        active={state.orderedList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <span className="text-xs">1.</span>
      </ToolbarButton>

      <ToolbarButton
        label="Quote"
        active={state.blockquote}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ”
      </ToolbarButton>

      <ToolbarButton
        label="Code block"
        active={state.codeBlock}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <span className="font-mono text-xs">{"{}"}</span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Undo"
        disabled={disabled || !state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↺
      </ToolbarButton>

      <ToolbarButton
        label="Redo"
        disabled={disabled || !state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↻
      </ToolbarButton>
    </div>
  );
}

function Divider(): JSX.Element {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/10" />;
}

type ToolbarButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
};

function ToolbarButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: ToolbarButtonProps): JSX.Element {
  return (
    <button
      // Without this the button defaults to type="submit" and every format click
      // would post the form.
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`grid size-8 shrink-0 place-items-center rounded text-sm leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "bg-slate-600 text-white"
          : "text-neutral-400 hover:bg-white/10 hover:text-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}
