"use client";

import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $isLinkNode } from "@lexical/link";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { $isAtNodeEnd, $setBlocksType } from "@lexical/selection";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import type { RangeSelection } from "lexical";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { AtSign, Bold, ChevronDownIcon, Italic, Link, PencilIcon, Underline } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { cn } from "@/modules/ui/lib/utils";
import type { TextEditorProps } from "./editor";

const LowPriority = 1;

const supportedBlockTypes = new Set(["paragraph", "h1", "h2", "ul", "ol"]);

interface BlockType {
  [key: string]: string;
}

const blockTypeToBlockName: BlockType = {
  paragraph: "Normal",
  ol: "Numbered List",
  ul: "Bulleted List",
  h1: "Large Heading",
  h2: "Small Heading",
};

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
    return $isAtNodeEnd(focus) ? anchorNode : focusNode;
  } else {
    return $isAtNodeEnd(anchor) ? focusNode : anchorNode;
  }
};

const getButtonClassName = (active: boolean): string =>
  active
    ? "bg-slate-100 text-slate-900 hover:bg-slate-200"
    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  tooltipText: string;
  disabled: boolean;
}

const ToolbarButton = ({ icon: Icon, active, onClick, tooltipText, disabled }: ToolbarButtonProps) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={getButtonClassName(active)}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const ToolbarPlugin = (
  props: TextEditorProps & {
    setShowRecallItemSelect: (show: boolean) => void;
    recallItemsCount?: number;
    setShowFallbackInput: (show: boolean) => void;
    setShowLinkEditor: (show: boolean) => void;
  }
) => {
  const [editor] = useLexicalComposerContext();

  const { t } = useTranslation();
  const toolbarRef = useRef(null);
  const [blockType, setBlockType] = useState("paragraph");
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);

  // save ref to setText to use it in event listeners safely
  const setText = useRef<any>(props.setText);

  useEffect(() => {
    setText.current = props.setText;
  }, [props]);

  const formatParagraph = () => {
    if (blockType !== "paragraph") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    }
  };

  const formatLargeHeading = () => {
    if (blockType !== "h1") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode("h1"));
        }
      });
    }
  };

  const formatSmallHeading = () => {
    if (blockType !== "h2") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode("h2"));
        }
      });
    }
  };

  const formatBulletList = () => {
    if (blockType !== "ul") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const formatNumberedList = () => {
    if (blockType !== "ol") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const format = (newBlockType: string) => {
    switch (newBlockType) {
      case "paragraph":
        formatParagraph();
        break;
      case "ul":
        formatBulletList();
        break;
      case "ol":
        formatNumberedList();
        break;
      case "h1":
        formatLargeHeading();
        break;
      case "h2":
        formatSmallHeading();
        break;
    }
  };

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setHasTextSelection(!selection.isCollapsed());
      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode);
          const type = parentList ? parentList.getTag() : element.getTag();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element) ? element.getTag() : element.getType();
          setBlockType(type);
        }
      }
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }
    }
  }, [editor]);

  useEffect(() => {
    if (!props.firstRender) {
      editor.update(() => {
        const root = $getRoot();
        if (root) {
          editor.update(() => {
            const parser = new DOMParser();
            // Create a new TextNode
            const dom = parser.parseFromString(props.getText(), "text/html");

            const nodes = $generateNodesFromDOM(editor, dom);
            root.clear();
            root.append(...nodes);
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.updateTemplate, props.firstRender]);

  useEffect(() => {
    if (props.setFirstRender && props.firstRender) {
      props.setFirstRender(false);
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(props.getText(), "text/html");

        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register text-saving update listener - always active for each editor instance
  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const textInHtml = $generateHtmlFromNodes(editor)
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/white-space:\s*pre-wrap;?/g, "");
        setText.current(textInHtml);
      });
    });

    return unregister;
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload) => {
          updateToolbar();
          return false;
        },
        LowPriority
      )
    );
  }, [editor, updateToolbar]);

  const insertLink = useCallback(() => {
    if (!isLink) {
      // Check if there's text selected before opening link editor
      editor.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
          return; // Don't open link editor if no text is selected
        }
        props.setShowLinkEditor(true);
      });
    } else {
      // If we're already in a link, open the editor to edit it
      props.setShowLinkEditor(true);
    }
  }, [editor, isLink, props]);

  // Removed custom PASTE_COMMAND handler to allow Lexical's default paste handler
  // to properly preserve rich text formatting (bold, italic, links, etc.)

  if (!props.editable) return <></>;

  const getLinkItemTooltipText = () => {
    if (!props.isExternalUrlsAllowed) {
      return t("environments.surveys.edit.external_urls_paywall_tooltip");
    }

    return isLink ? t("environments.surveys.edit.edit_link") : t("environments.surveys.edit.insert_link");
  };

  const items = [
    {
      key: "bold",
      icon: Bold,
      onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
      active: isBold,
      tooltipText: t("environments.surveys.edit.bold"),
      disabled: false,
    },
    {
      key: "italic",
      icon: Italic,
      onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
      active: isItalic,
      tooltipText: t("environments.surveys.edit.italic"),
      disabled: false,
    },
    {
      key: "underline",
      icon: Underline,
      onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"),
      active: isUnderline,
      tooltipText: t("environments.surveys.edit.underline"),
      disabled: false,
    },
    {
      key: "link",
      icon: Link,
      onClick: insertLink,
      active: isLink,
      tooltipText: getLinkItemTooltipText(),
      disabled: !props.isExternalUrlsAllowed || (!isLink && !hasTextSelection),
    },
    {
      key: "recall",
      icon: AtSign,
      onClick: () => props.setShowRecallItemSelect(true),
      active: false,
      tooltipText: t("environments.surveys.edit.recall_data"),
      disabled: false,
    },
    {
      key: "editRecall",
      icon: PencilIcon,
      onClick: () => props.setShowFallbackInput(true),
      active: false,
      tooltipText: t("environments.surveys.edit.edit_recall"),
      disabled: !props.recallItemsCount || props.recallItemsCount === 0,
    },
  ];

  return (
    <div className="toolbar flex" ref={toolbarRef}>
      {!props.excludedToolbarItems?.includes("blockType") && supportedBlockTypes.has(blockType) && (
        <DropdownMenu>
          <DropdownMenuTrigger className="text-subtle">
            <>
              <span className={cn("icon", blockType)} />
              <span className="text text-default hidden sm:flex">
                {blockTypeToBlockName[blockType as keyof BlockType]}
              </span>
              <ChevronDownIcon className="text-default ml-2 h-4 w-4" />
            </>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.keys(blockTypeToBlockName).map((key) => {
              return (
                <DropdownMenuItem key={key} asChild>
                  <Button
                    type="button"
                    onClick={() => format(key)}
                    className={cn(
                      "w-full rounded-none focus:ring-0",
                      blockType === key ? "bg-subtle w-full" : ""
                    )}>
                    <>
                      <span className={cn("icon block-type", key)} />
                      <span>{blockTypeToBlockName[key]}</span>
                    </>
                  </Button>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex items-center gap-1">
        {items.map(({ key, icon, onClick, active, tooltipText, disabled }) =>
          !props.excludedToolbarItems?.includes(key) ? (
            <ToolbarButton
              key={key}
              icon={icon}
              active={active}
              disabled={disabled}
              onClick={onClick}
              tooltipText={tooltipText}
            />
          ) : null
        )}
      </div>
    </div>
  );
};
