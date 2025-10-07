"use client";

import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useTranslate } from "@tolgee/react";
import type { LexicalEditor, RangeSelection } from "lexical";
import { $getSelection, $isRangeSelection } from "lexical";
import { useEffect, useRef, useState } from "react";
import { isStringUrl } from "@/lib/utils/url";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

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

const validateUrl = (url: string): boolean => {
  // Use existing helper for basic URL validation
  if (!isStringUrl(url)) {
    return false;
  }

  try {
    const urlObj = new URL(url);
    // Ensure valid protocol (http or https)
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }
    // Ensure proper domain structure (has a dot) or is localhost
    return urlObj.hostname.includes(".") || urlObj.hostname === "localhost";
  } catch {
    return false;
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
  const { t } = useTranslate();

  useEffect(() => {
    if (open) {
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

  const linkAttributes = {
    target: "_blank",
    rel: "noopener noreferrer",
  };

  const handleSubmit = () => {
    if (linkUrl) {
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
            className="focus:border-brand-dark h-9 min-w-80 bg-white"
            ref={inputRef}
            value={linkUrl}
            placeholder="https://example.com"
            autoFocus
            onInput={(event) => {
              const value = event.currentTarget.value;
              setLinkUrl(value);

              // Update custom validity message on input
              if (value && !validateUrl(value)) {
                event.currentTarget.setCustomValidity("Please enter a valid URL (e.g., https://example.com)");
              } else {
                event.currentTarget.setCustomValidity("");
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
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
};

export const LinkEditor = ({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) => {
  const [editor] = useLexicalComposerContext();
  return <LinkEditorContent editor={editor} open={open} setOpen={setOpen} />;
};
