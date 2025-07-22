"use client";

import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { cn } from "@/modules/ui/lib/utils";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { $isAtNodeEnd, $wrapNodes } from "@lexical/selection";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import type { BaseSelection, EditorState, LexicalEditor, NodeSelection, RangeSelection } from "lexical";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_TEXT_COMMAND,
  PASTE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { Bold, ChevronDownIcon, Italic, Link, Underline } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AddVariablesDropdown } from "./add-variables-dropdown";
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

const positionEditorElement = (editor: HTMLInputElement, rect: DOMRect | null) => {
  if (rect === null) {
    editor.style.opacity = "0";
    editor.style.top = "-1000px";
    editor.style.left = "-1000px";
  } else {
    editor.style.opacity = "1";
    editor.style.top = `${rect.top + rect.height + window.pageYOffset + 10}px`;
    editor.style.left = `${rect.left + window.pageXOffset - editor.offsetWidth / 2 + rect.width / 2}px`;
  }
};

const FloatingLinkEditor = ({ editor }: { editor: LexicalEditor }) => {
  const editorRef = useRef<HTMLInputElement>(null);
  const mouseDownRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [isEditMode, setEditMode] = useState(false);
  const [lastSelection, setLastSelection] = useState<RangeSelection | NodeSelection | BaseSelection | null>(
    null
  );

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent)) {
        setLinkUrl(parent.getURL());
      } else if ($isLinkNode(node)) {
        setLinkUrl(node.getURL());
      } else {
        setLinkUrl("");
      }
    }
    const editorElem = editorRef.current;
    const nativeSelection = window.getSelection();
    const activeElement = document.activeElement;

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    if (
      selection !== null &&
      !nativeSelection?.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection?.anchorNode || null)
    ) {
      const domRange = nativeSelection?.getRangeAt(0);
      let rect: DOMRect | undefined;
      if (nativeSelection?.anchorNode === rootElement) {
        let inner: Element = rootElement;
        while (inner.firstElementChild != null) {
          inner = inner.firstElementChild;
        }
        rect = inner.getBoundingClientRect();
      } else {
        rect = domRange?.getBoundingClientRect();
      }
      if (!mouseDownRef.current) {
        positionEditorElement(editorElem, rect || null);
      }

      setLastSelection(selection);
    } else if (!activeElement || activeElement.className !== "link-input") {
      positionEditorElement(editorElem, null);
      setLastSelection(null);
      setEditMode(false);
      setLinkUrl("");
    }

    return true;
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }: { editorState: EditorState }) => {
        editorState.read(() => {
          updateLinkEditor();
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditor();
          return true;
        },
        LowPriority
      )
    );
  }, [editor, updateLinkEditor]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateLinkEditor();
    });
  }, [editor, updateLinkEditor]);

  useEffect(() => {
    if (isEditMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditMode]);

  useEffect(() => {
    setEditMode(true);
  }, []);

  const linkAttributes = {
    target: "_blank",
    rel: "noopener noreferrer",
  };

  const handleSubmit = () => {
    if (lastSelection && linkUrl) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
        url: linkUrl,
        ...linkAttributes,
      });
    }
    setEditMode(false);
  };

  return (
    <div ref={editorRef} className="link-editor">
      {isEditMode && (
        <div className="flex">
          <Input
            className="bg-white"
            ref={inputRef}
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSubmit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setEditMode(false);
              }
            }}
          />
          <Button className="py-2" onClick={handleSubmit}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
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

export const ToolbarPlugin = (props: TextEditorProps & { container: HTMLElement | null }) => {
  const [editor] = useLexicalComposerContext();

  const toolbarRef = useRef(null);
  const [blockType, setBlockType] = useState("paragraph");
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

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
          $wrapNodes(selection, () => $createParagraphNode());
        }
      });
    }
  };

  const formatLargeHeading = () => {
    if (blockType !== "h1") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode("h1"));
        }
      });
    }
  };

  const formatSmallHeading = () => {
    if (blockType !== "h2") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode("h2"));
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

  const addVariable = (variable: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        editor.update(() => {
          const formatedVariable = `{${variable.toUpperCase().replace(/ /g, "_")}}`;
          selection?.insertRawText(formatedVariable);
        });
      }
    });
  };

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
            const paragraph = $createParagraphNode();
            root.clear().append(paragraph);
            paragraph.select();
            $insertNodes(nodes);
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
        const paragraph = $createParagraphNode();
        $getRoot().clear().append(paragraph);

        paragraph.select();

        $getRoot().select();
        $insertNodes(nodes);

        editor.registerUpdateListener(({ editorState, prevEditorState }) => {
          editorState.read(() => {
            const textInHtml = $generateHtmlFromNodes(editor)
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/white-space:\s*pre-wrap;?/g, "");
            setText.current(textInHtml);
          });
          if (!prevEditorState._selection) editor.blur();
        });
      });
    }
  }, []);

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
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
        url: "https://",
      });
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData("text/plain");

        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertRawText(text ?? "");
          }
        });

        e.preventDefault();
        return true; // Prevent the default paste handler
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor]);

  if (!props.editable) return <></>;

  const items = [
    {
      key: "bold",
      icon: Bold,
      onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
      active: isBold,
    },
    {
      key: "italic",
      icon: Italic,
      onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
      active: isItalic,
    },
    {
      key: "underline",
      icon: Underline,
      onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"),
      active: isUnderline,
    },
    {
      key: "link",
      icon: Link,
      onClick: insertLink,
      active: isLink,
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
                <DropdownMenuItem key={key}>
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

      {items.map(({ key, icon: Icon, onClick, active }) =>
        !props.excludedToolbarItems?.includes(key) ? (
          <Button
            key={key}
            variant="ghost"
            type="button"
            onClick={onClick}
            className={active ? "bg-subtle active-button" : "inactive-button"}>
            <Icon />
          </Button>
        ) : null
      )}
      {isLink &&
        !props.excludedToolbarItems?.includes("link") &&
        createPortal(<FloatingLinkEditor editor={editor} />, props.container ?? document.body)}

      {props.variables && (
        <div className="ml-auto">
          <AddVariablesDropdown
            addVariable={addVariable}
            isTextEditor={true}
            variables={props.variables || []}
          />
        </div>
      )}
    </div>
  );
};
