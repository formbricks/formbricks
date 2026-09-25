"use client";

import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { LexicalEditor, RangeSelection } from "lexical";
import { $getSelection, $isRangeSelection } from "lexical";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { isMailtoUrl, isValidEditorLinkUrl } from "../lib/link-url";

const getSelectedNode = (selection: RangeSelection) => {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return focus.offset === focusNode.getTextContentSize() ? anchorNode : focusNode;
  } else {
    return anchor.offset === anchorNode.getTextContentSize() ? focusNode : anchorNode;
  }
};

interface LinkEditorProps {
  editor: LexicalEditor;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const LinkEditorContent = ({ editor, open, setOpen }: LinkEditorProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState("");
  const { t } = useTranslation();
  useEffect(() => {
    if (open) {
      setError("");
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = getSelectedNode(selection);
          const parent = node.getParent();
          if ($isLinkNode(parent)) {
            setLinkUrl(parent.getURL());
          } else if ($isLinkNode(node)) {
            setLinkUrl(node.getURL());
          } else {
            setLinkUrl("https://");
          }
        }
      });
    }
  }, [open, editor]);

  const handleSubmit = () => {
    if (!isValidEditorLinkUrl(linkUrl)) {
      setError(t("workspace.surveys.edit.please_enter_a_valid_url"));
      return;
    }
    if (linkUrl) {
      // mailto: links keep the current tab, like auto-linked emails: handing off to the mail client
      // does not navigate the respondent away from their response. `null` clears the attributes when an
      // existing web link is edited into a mailto: link.
      const linkAttributes = isMailtoUrl(linkUrl)
        ? { target: null, rel: null }
        : { target: "_blank", rel: "noopener noreferrer" };
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
        url: linkUrl,
        ...linkAttributes,
      });
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="z-10 h-0 w-full cursor-pointer" />
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border border-slate-300 bg-slate-50 p-3 text-xs shadow-lg"
        align="start"
        side="bottom"
        sideOffset={4}>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (inputRef.current?.checkValidity()) {
              handleSubmit();
            } else {
              inputRef.current?.reportValidity();
            }
          }}>
          <Input
            type="url"
            required
            className="h-9 min-w-80 bg-white focus:border-brand-dark"
            ref={inputRef}
            value={linkUrl}
            placeholder="https://example.com"
            autoFocus
            onInput={(event) => {
              const value = event.currentTarget.value;
              setLinkUrl(value);
              if (error && isValidEditorLinkUrl(value)) {
                setError("");
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                // Trigger native validation
                if (inputRef.current?.checkValidity()) {
                  handleSubmit();
                } else {
                  inputRef.current?.reportValidity();
                }
              } else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
          <Button type="submit" className="h-9">
            {t("common.save")}
          </Button>
        </form>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </PopoverContent>
    </Popover>
  );
};

export const LinkEditor = ({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) => {
  const [editor] = useLexicalComposerContext();
  return <LinkEditorContent editor={editor} open={open} setOpen={setOpen} />;
};
