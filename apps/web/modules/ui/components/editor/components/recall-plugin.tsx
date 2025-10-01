"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  EditorState,
  KEY_DOWN_COMMAND,
  LexicalNode,
  TextNode,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getFallbackValues, getRecallItems } from "@/lib/utils/recall";
import { FallbackInput } from "@/modules/survey/components/question-form-input/components/fallback-input";
import { RecallItemSelect } from "@/modules/survey/components/question-form-input/components/recall-item-select";
import { $createRecallNode, RecallNode } from "./recall-node";

interface RecallPluginProps {
  localSurvey: TSurvey;
  questionId: string;
  selectedLanguageCode: string;
  container?: HTMLElement;
  recallItems: TSurveyRecallItem[];
  setRecallItems: (recallItems: TSurveyRecallItem[]) => void;
  showFallbackInput: boolean;
  setShowFallbackInput: (showFallbackInput: boolean) => void;
}

export const RecallPlugin = ({
  localSurvey,
  questionId,
  selectedLanguageCode,
  container,
  recallItems,
  setRecallItems,
  showFallbackInput,
  setShowFallbackInput,
}: RecallPluginProps) => {
  const [editor] = useLexicalComposerContext();
  const [showRecallItemSelect, setShowRecallItemSelect] = useState(false);
  const [fallbacks, setFallbacks] = useState<{ [id: string]: string }>({});
  const [atSymbolPosition, setAtSymbolPosition] = useState<{ node: LexicalNode; offset: number } | null>(
    null
  );
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  // Helper function to collect all text nodes
  const collectTextNodes = useCallback((root: LexicalNode): TextNode[] => {
    const allTextNodes: TextNode[] = [];

    const traverse = (node: LexicalNode) => {
      try {
        if ($isTextNode(node)) {
          allTextNodes.push(node);
        } else if ($isElementNode(node)) {
          const children = node.getChildren();
          children.forEach(traverse);
        }
      } catch (error) {
        console.error("Error traversing node:", error);
      }
    };

    traverse(root);
    return allTextNodes;
  }, []);

  // Helper function to create nodes from text parts and matches
  const createNodesFromText = useCallback(
    (parts: string[], matches: string[]): LexicalNode[] => {
      const newNodes: LexicalNode[] = [];

      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          newNodes.push($createTextNode(parts[i]));
        }

        if (i < matches.length) {
          const matchText = matches[i];
          const items = getRecallItems(matchText, localSurvey, selectedLanguageCode);
          const fallbackValues = getFallbackValues(matchText);

          if (items.length > 0) {
            const recallItem = items[0];
            const fallbackValue = fallbackValues[recallItem.id] || "";
            newNodes.push($createRecallNode({ recallItem, fallbackValue }));
          }
        }
      }

      return newNodes;
    },
    [localSurvey, selectedLanguageCode]
  );

  // Helper function to replace text node with new nodes
  const replaceTextNode = useCallback((node: TextNode, newNodes: LexicalNode[]) => {
    if (newNodes.length === 0) return;

    try {
      newNodes.forEach((newNode, index) => {
        if (index === 0) {
          node.insertBefore(newNode);
        } else {
          newNodes[index - 1].insertAfter(newNode);
        }
      });
      node.remove();
    } catch (error) {
      console.error("Error replacing text node:", error);
    }
  }, []);

  // Convert raw recall text to RecallNodes
  const convertTextToRecallNodes = useCallback(() => {
    const root = $getRoot();
    const allTextNodes = collectTextNodes(root);
    const recallPattern = /#recall:[A-Za-z0-9_-]+\/fallback:[^#]*#/g;

    allTextNodes.forEach((node) => {
      const textContent = node.getTextContent();

      if (recallPattern.test(textContent)) {
        const matches = textContent.match(/#recall:[A-Za-z0-9_-]+\/fallback:[^#]*#/g) || [];

        if (matches.length > 0) {
          const parts = textContent.split(/#recall:[A-Za-z0-9_-]+\/fallback:[^#]*#/);
          const newNodes = createNodesFromText(parts, matches);
          replaceTextNode(node, newNodes);
        }
      }
    });
  }, [collectTextNodes, createNodesFromText, replaceTextNode]);

  // Sync plugin state with actual RecallNodes in the editor
  const syncStateWithEditor = useCallback(() => {
    const root = $getRoot();
    const currentRecallItems: TSurveyRecallItem[] = [];
    const currentFallbacks: { [id: string]: string } = {};

    // Function to recursively find all RecallNodes
    const findRecallNodes = (node: LexicalNode): RecallNode[] => {
      const recallNodes: RecallNode[] = [];

      if (node instanceof RecallNode) {
        recallNodes.push(node);
      }

      // Only get children if this is an ElementNode
      if ($isElementNode(node)) {
        try {
          const children = node.getChildren();
          children.forEach((child: LexicalNode) => {
            recallNodes.push(...findRecallNodes(child));
          });
        } catch (error) {
          console.error("Error getting children from node during sync:", error);
        }
      }

      return recallNodes;
    };

    const allRecallNodes = findRecallNodes(root);

    // Build current state from actual nodes in editor
    allRecallNodes.forEach((recallNode) => {
      const recallItem = recallNode.getRecallItem();
      const fallbackValue = recallNode.getFallbackValue();

      currentRecallItems.push(recallItem);
      currentFallbacks[recallItem.id] = fallbackValue;
    });

    // Update plugin state to match editor content
    setRecallItems(currentRecallItems);
    setFallbacks(currentFallbacks);
  }, []);

  // Monitor editor content for recall patterns
  const handleEditorUpdate = useCallback(
    ({ editorState }: { editorState: EditorState }) => {
      editorState.read(() => {
        const fullText = $getRoot().getTextContent();

        // Check for recall patterns in full text
        if (fullText.includes("#recall:")) {
          const items = getRecallItems(fullText, localSurvey, selectedLanguageCode);
          const fallbackValues = getFallbackValues(fullText);
          setRecallItems(items);
          setFallbacks(fallbackValues);

          // Convert any raw recall text to visual nodes
          editor.update(() => {
            convertTextToRecallNodes();
          });
        } else {
          // No raw recall patterns, but sync state with existing RecallNodes
          syncStateWithEditor();
        }
      });
    },
    [localSurvey, selectedLanguageCode, editor, convertTextToRecallNodes, syncStateWithEditor]
  );

  // Handle @ key press for recall trigger
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check if @ was pressed (Shift + 2 on most keyboards)
      if (event.key === "@") {
        // Small delay to let the character be inserted first
        setTimeout(() => {
          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchorOffset = selection.anchor.offset;
              const anchorNode = selection.anchor.getNode();

              // Check if the current node is a text node and contains @
              if ($isTextNode(anchorNode)) {
                const nodeText = anchorNode.getTextContent();

                // Check if there's an @ at the current cursor position (just typed)
                if (nodeText[anchorOffset - 1] === "@") {
                  // Store the position of the @ symbol
                  setAtSymbolPosition({
                    node: anchorNode,
                    offset: anchorOffset - 1,
                  });

                  setShowRecallItemSelect(true);
                }
              }
            }
          });
        }, 10);
      }
      return false;
    },
    [editor]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (showRecallItemSelect) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest("[data-recall-dropdown]")) {
          setShowRecallItemSelect(false);
          setAtSymbolPosition(null); // Clear stored position when closing
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showRecallItemSelect]);

  // Clean up when dropdown closes
  useEffect(() => {
    if (!showRecallItemSelect && atSymbolPosition) {
      // If dropdown was closed without selecting an item, clear the stored position
      setAtSymbolPosition(null);
    }
  }, [showRecallItemSelect, atSymbolPosition]);

  // Initial conversion of existing recall text and state sync on plugin load
  useEffect(() => {
    // Run initial conversion to handle any existing recall text
    editor.update(() => {
      convertTextToRecallNodes();
    });

    // Also sync state with any existing RecallNodes
    setTimeout(() => {
      editor.getEditorState().read(() => {
        syncStateWithEditor();
      });
    }, 100);
  }, [editor, convertTextToRecallNodes, syncStateWithEditor]);

  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(handleEditorUpdate);
    const removeKeyListener = editor.registerCommand(KEY_DOWN_COMMAND, handleKeyDown, COMMAND_PRIORITY_HIGH);

    return () => {
      removeUpdateListener();
      removeKeyListener();
    };
  }, [editor, handleEditorUpdate, handleKeyDown]);

  // Helper function to replace @ symbol with recall node using stored position
  const replaceAtSymbolWithStoredPosition = useCallback(
    (recallNode: RecallNode) => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      selection.setTextNodeRange(
        atSymbolPosition!.node as TextNode,
        atSymbolPosition!.offset,
        atSymbolPosition!.node as TextNode,
        atSymbolPosition!.offset + 1
      );
      selection.insertNodes([recallNode]);
      return true;
    },
    [atSymbolPosition]
  );

  // Helper function to replace @ symbol using current selection
  const replaceAtSymbolWithCurrentSelection = useCallback((recallNode: RecallNode) => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return false;

    const anchorOffset = selection.anchor.offset;
    const anchorNode = selection.anchor.getNode();

    if ($isTextNode(anchorNode)) {
      const nodeText = anchorNode.getTextContent();
      if (nodeText[anchorOffset - 1] === "@") {
        selection.setTextNodeRange(anchorNode, anchorOffset - 1, anchorNode, anchorOffset);
        selection.insertNodes([recallNode]);
        return true;
      }
    }

    // Fallback: insert at current position
    selection.insertNodes([recallNode]);
    return true;
  }, []);

  const addRecallItem = useCallback(
    (recallItem: TSurveyRecallItem) => {
      const handleRecallInsert = () => {
        const recallNode = $createRecallNode({
          recallItem,
          fallbackValue: "",
        });

        const success =
          atSymbolPosition && $isTextNode(atSymbolPosition.node)
            ? replaceAtSymbolWithStoredPosition(recallNode)
            : replaceAtSymbolWithCurrentSelection(recallNode);

        if (!success) {
          // Ultimate fallback
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([recallNode]);
          }
        }
      };

      editor.update(handleRecallInsert);
      setAtSymbolPosition(null);
      setShowRecallItemSelect(false);
      setShowFallbackInput(true);

      setTimeout(() => {
        editor.getEditorState().read(() => {
          syncStateWithEditor();
        });
      }, 0);
    },
    [
      editor,
      syncStateWithEditor,
      atSymbolPosition,
      replaceAtSymbolWithStoredPosition,
      replaceAtSymbolWithCurrentSelection,
    ]
  );

  // Helper function to find all RecallNodes recursively
  const findAllRecallNodes = useCallback((node: LexicalNode): RecallNode[] => {
    const recallNodes: RecallNode[] = [];

    if (node instanceof RecallNode) {
      recallNodes.push(node);
    }

    // Only get children if this is an ElementNode
    if ($isElementNode(node)) {
      try {
        const children = node.getChildren();
        children.forEach((child: LexicalNode) => {
          recallNodes.push(...findAllRecallNodes(child));
        });
      } catch (error) {
        console.error("Error getting children from node:", error);
      }
    }

    return recallNodes;
  }, []);

  const addFallback = useCallback(() => {
    const handleFallbackUpdate = () => {
      // Find all RecallNodes and update their fallback values
      const root = $getRoot();
      const allRecallNodes = findAllRecallNodes(root);

      allRecallNodes.forEach((recallNode) => {
        const recallItem = recallNode.getRecallItem();
        const newFallbackValue = fallbacks[recallItem.id] || "";

        // Update the fallback value in the node
        recallNode.setFallbackValue(newFallbackValue);
      });
    };

    editor.update(handleFallbackUpdate);
    setShowFallbackInput(false);

    // Sync state with editor after fallback update
    setTimeout(() => {
      editor.getEditorState().read(() => {
        syncStateWithEditor();
      });
    }, 0);
  }, [editor, fallbacks, syncStateWithEditor, findAllRecallNodes]);

  return (
    <>
      {/* Recall Item Select Modal */}
      {showRecallItemSelect && (
        <RecallItemSelect
          localSurvey={localSurvey}
          questionId={questionId}
          addRecallItem={addRecallItem}
          setShowRecallItemSelect={setShowRecallItemSelect}
          recallItems={recallItems}
          selectedLanguageCode={selectedLanguageCode}
          hiddenFields={localSurvey.hiddenFields}
        />
      )}

      {/* Fallback Input Modal */}
      {showFallbackInput &&
        recallItems.length > 0 &&
        createPortal(
          <FallbackInput
            filteredRecallItems={recallItems}
            fallbacks={fallbacks}
            setFallbacks={setFallbacks}
            fallbackInputRef={fallbackInputRef as React.RefObject<HTMLInputElement>}
            addFallback={addFallback}
            open={showFallbackInput}
            setOpen={setShowFallbackInput}
          />,
          container || document.body
        )}
    </>
  );
};
