"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { PencilIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { FallbackInput } from "@/modules/survey/components/element-form-input/components/fallback-input";
import { $getOneLineText, $setOneLineText, registerOneLineEditor } from "../lib/one-line-editor";
import { ChipClickPlugin } from "./chip-click-plugin";
import { RecallNode } from "./recall-node";
import { RecallPlugin } from "./recall-plugin";
import type { TEditorRecallSource } from "./recall-source";
import { useFallbackPopover } from "./use-fallback-popover";

interface RecallInputProps {
  /** Stored text, recall tokens included. */
  value: string;
  onChange: (value: string) => void;
  /** Where `@` gets its items and its menu; keep its identity stable (memoize it). */
  recallSource: TEditorRecallSource;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  /** Draws the field's border red, as `Input` does. */
  isInvalid?: boolean;
}

const OneLinePlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => registerOneLineEditor(editor), [editor]);
  return null;
};

const SyncEditablePlugin = ({ editable }: Readonly<{ editable: boolean }>) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (editor.isEditable() !== editable) editor.setEditable(editable);
  }, [editor, editable]);
  return null;
};

/**
 * Keeps the editor and `value` in step: the editor's text goes out through `onChange`, and a `value`
 * that changes from outside (a row removed above this one) re-seeds the editor.
 */
const ValuePlugin = ({ value, onChange }: Readonly<{ value: string; onChange: (value: string) => void }>) => {
  const [editor] = useLexicalComposerContext();
  const lastValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        const text = editorState.read($getOneLineText);
        if (text === lastValueRef.current) return;
        lastValueRef.current = text;
        onChangeRef.current(text);
      }),
    [editor]
  );

  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    editor.update(() => $setOneLineText(value));
  }, [editor, value]);

  return null;
};

/**
 * A one-line field with recall: `@` opens the source's menu, a recalled value shows as the same chip
 * the rich-text `Editor` uses, and its fallback is edited from the chip or the pencil, as in the
 * `Editor`. The value is plain text with `#recall:<id>/fallback:<text>#` tokens.
 */
export const RecallInput = ({
  value,
  onChange,
  recallSource,
  id,
  disabled,
  placeholder,
  className,
  isInvalid,
  ...rest
}: Readonly<RecallInputProps>) => {
  const { t } = useTranslation();
  const editable = !disabled;
  const [recallItems, setRecallItems] = useState<TSurveyRecallItem[]>([]);
  const [fallbacks, setFallbacks] = useState<{ [id: string]: string }>({});
  const [addFallbackFunction, setAddFallbackFunction] = useState<(() => void) | null>(null);
  const fallbackPopover = useFallbackPopover();
  const showFallbackInput = fallbackPopover.isOpen;
  const setShowFallbackInput = fallbackPopover.setOpen;
  const [showRecallItemSelect, setShowRecallItemSelect] = useState(false);

  // Read once: LexicalComposer only uses its initial config at mount; `ValuePlugin` handles changes.
  const [initialConfig] = useState(() => ({
    namespace: "recall-input",
    nodes: [RecallNode],
    editable,
    onError: (error: Error) => {
      throw error;
    },
    editorState: () => $setOneLineText(value),
  }));

  return (
    <div className={cn("relative", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                id={id}
                aria-label={rest["aria-label"]}
                className={cn(
                  "flex h-10 w-full no-scrollbar items-center overflow-x-auto overflow-y-hidden rounded-md border border-slate-300 bg-white px-3 py-2 text-base break-normal! whitespace-pre! text-slate-800 focus:border-brand-dark focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:outline-hidden sm:text-sm",
                  recallItems.length > 0 && editable && "pr-9",
                  !editable && "cursor-not-allowed opacity-50",
                  isInvalid && "border-red-500 focus:border-red-500"
                )}
              />
            }
            placeholder={
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 truncate px-3 text-base leading-10 text-slate-500 sm:text-sm">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          {recallItems.length > 0 && editable ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label={t("workspace.surveys.edit.edit_recall")}
              title={t("workspace.surveys.edit.edit_recall")}
              onClick={() => setShowFallbackInput(true)}>
              <PencilIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
        <OneLinePlugin />
        {editable ? <ChipClickPlugin onChipClick={fallbackPopover.openForChip} /> : null}
        <SyncEditablePlugin editable={editable} />
        <ValuePlugin value={value} onChange={onChange} />
        <div className="absolute top-full left-0 w-full">
          <RecallPlugin
            recallSource={recallSource}
            recallItems={recallItems}
            setRecallItems={setRecallItems}
            fallbacks={fallbacks}
            setFallbacks={setFallbacks}
            onShowFallbackInput={() => setShowFallbackInput(true)}
            setAddFallbackFunction={setAddFallbackFunction}
            setShowRecallItemSelect={setShowRecallItemSelect}
            showRecallItemSelect={showRecallItemSelect}
          />
        </div>
      </LexicalComposer>
      {recallItems.length > 0 && (
        <div className="absolute top-full left-0 w-full">
          <FallbackInput
            filteredRecallItems={recallItems}
            fallbacks={fallbacks}
            setFallbacks={setFallbacks}
            addFallback={addFallbackFunction ?? (() => {})}
            open={showFallbackInput}
            setOpen={setShowFallbackInput}
            focusItemId={fallbackPopover.focusItemId}
          />
        </div>
      )}
    </div>
  );
};
