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
import { useCallback, useEffect, useState } from "react";
import { logger } from "@formbricks/logger";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getFallbackValues, getRecallItems } from "@/lib/utils/recall";
import { RecallItemSelect } from "@/modules/survey/components/element-form-input/components/recall-item-select";
import { $createRecallNode, RecallNode } from "./recall-node";

interface RecallPluginProps {
  localSurvey: TSurvey;
  elementId: string;
  selectedLanguageCode: string;
  recallItems: TSurveyRecallItem[];
  setRecallItems: (recallItems: TSurveyRecallItem[]) => void;
  fallbacks: { [id: string]: string };
  setFallbacks: (fallbacks: { [id: string]: string }) => void;
  onShowFallbackInput: () => void;
  setAddFallbackFunction: (fn: (() => void) | null) => void;
  setShowRecallItemSelect: (show: boolean) => void;
  showRecallItemSelect: boolean;
}

export const RecallPlugin = ({
  localSurvey,
  elementId,
  selectedLanguageCode,
  recallItems,
  setRecallItems,
  fallbacks,
  setFallbacks,
  onShowFallbackInput,
  setAddFallbackFunction,
  setShowRecallItemSelect,
  showRecallItemSelect,
}: RecallPluginProps) => {
  const [editor] = useLexicalComposerContext();
  const [atSymbolPosition, setAtSymbolPosition] = useState<{ node: LexicalNode; offset: number } | null>(
    null
  );

  // Helper function to collect all text nodes
  const collectTextNodes = useCallback((root: LexicalNode): TextNode[] => {
    const allTextNodes: TextNode[] = [];

    const traverse = (node: LexicalNode) => {
      try {
        if ($isTextNode(node)) {
          allTextNodes.push(node);
        } else if ($isElementNode(node)) {
          const children = node.getChildren();
          for (const child of children) {
            traverse(child);
          }
        }
      } catch (error) {
        logger.error("Error traversing node:", error);
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
            newNodes.push(
              $createRecallNode({
                recallItem,
                fallbackValue,
              })
            );
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
      for (let index = 0; index < newNodes.length; index++) {
        const newNode = newNodes[index];
        if (index === 0) {
          node.insertBefore(newNode);
        } else {
          newNodes[index - 1].insertAfter(newNode);
        }
      }
      node.remove();
    } catch (error) {
      logger.error("Error replacing text node:", error);
    }
  }, []);

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
        for (const child of children) {
          const childRecallNodes = findAllRecallNodes(child);
          recallNodes.push(...childRecallNodes);
        }
      } catch (error) {
        logger.error("Error getting children from node:", error);
      }
    }

    return recallNodes;
  }, []);

  // Convert raw recall text to RecallNodes
  const convertTextToRecallNodes = useCallback(() => {
    const root = $getRoot();
    const allTextNodes = collectTextNodes(root);
    const recallPattern = /#recall:[A-Za-z0-9_-]+\/fallback:[^#]*#/g;

    for (const node of allTextNodes) {
      const textContent = node.getTextContent();
      const matches = textContent.match(recallPattern);

      if (matches && matches.length > 0) {
        const parts = textContent.split(recallPattern);
        const newNodes = createNodesFromText(parts, matches);
        replaceTextNode(node, newNodes);
      }
    }
  }, [collectTextNodes, createNodesFromText, replaceTextNode]);

  // Monitor editor content for recall patterns
  const handleEditorUpdate = useCallback(
    ({ editorState }: { editorState: EditorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const fullText = root.getTextContent();

        // Find all RecallNodes in the editor
        const allRecallNodes = findAllRecallNodes(root);
        const currentRecallItems: TSurveyRecallItem[] = [];
        const currentFallbacks: { [id: string]: string } = {};

        // Extract recall items and fallbacks from existing RecallNodes
        for (const recallNode of allRecallNodes) {
          const recallItem = recallNode.getRecallItem();
          const fallbackValue = recallNode.getFallbackValue();

          currentRecallItems.push(recallItem);
          currentFallbacks[recallItem.id] = fallbackValue;
        }

        // Check for recall patterns in full text (for raw text that needs conversion)
        if (fullText.includes("#recall:")) {
          const items = getRecallItems(fullText, localSurvey, selectedLanguageCode);
          const fallbackValues = getFallbackValues(fullText);

          // Merge with existing RecallNodes
          const mergedItems = [...currentRecallItems];
          const mergedFallbacks = { ...currentFallbacks };

          for (const item of items) {
            if (!mergedItems.some((existing) => existing.id === item.id)) {
              mergedItems.push(item);
            }
            if (fallbackValues[item.id]) {
              mergedFallbacks[item.id] = fallbackValues[item.id];
            }
          }

          setRecallItems(mergedItems);
          setFallbacks(mergedFallbacks);

          // Convert any raw recall text to visual nodes
          editor.update(() => {
            convertTextToRecallNodes();
          });
        } else {
          // No raw recall patterns, sync state with existing RecallNodes only
          setRecallItems(currentRecallItems);
          setFallbacks(currentFallbacks);
        }
      });
    },
    [
      findAllRecallNodes,
      localSurvey,
      selectedLanguageCode,
      setRecallItems,
      setFallbacks,
      editor,
      convertTextToRecallNodes,
    ]
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
    [editor, setShowRecallItemSelect]
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
  }, [setShowRecallItemSelect, showRecallItemSelect]);

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
  }, [editor, convertTextToRecallNodes]);

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
      if (!$isRangeSelection(selection) || !atSymbolPosition) return false;

      selection.setTextNodeRange(
        atSymbolPosition.node as TextNode,
        atSymbolPosition.offset,
        atSymbolPosition.node as TextNode,
        atSymbolPosition.offset + 1
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

      // Immediately update recallItems state to include the new item
      const newItems = [...recallItems];
      if (!newItems.some((item) => item.id === recallItem.id)) {
        newItems.push(recallItem);
      }
      setRecallItems(newItems);

      // Show fallback input after state is updated
      setTimeout(() => {
        onShowFallbackInput();
      }, 0);
    },
    [
      editor,
      setShowRecallItemSelect,
      recallItems,
      setRecallItems,
      atSymbolPosition,
      replaceAtSymbolWithStoredPosition,
      replaceAtSymbolWithCurrentSelection,
      onShowFallbackInput,
    ]
  );

  const addFallback = useCallback(() => {
    const handleFallbackUpdate = () => {
      // Find all RecallNodes and update their fallback values
      const root = $getRoot();
      const allRecallNodes = findAllRecallNodes(root);

      for (const recallNode of allRecallNodes) {
        const recallItem = recallNode.getRecallItem();
        const newFallbackValue = (fallbacks[recallItem.id]?.trim() || "").replaceAll(" ", "nbsp");

        // Update the fallback value in the node
        recallNode.setFallbackValue(newFallbackValue);
      }
    };

    editor.update(handleFallbackUpdate);
  }, [editor, fallbacks, findAllRecallNodes]);

  // Expose addFallback function to parent
  useEffect(() => {
    setAddFallbackFunction(() => addFallback);
    return () => setAddFallbackFunction(null);
  }, [addFallback, setAddFallbackFunction]);

  return (
    <>
      {/* Recall Item Select Modal */}
      {showRecallItemSelect && (
        <RecallItemSelect
          localSurvey={localSurvey}
          elementId={elementId}
          addRecallItem={addRecallItem}
          setShowRecallItemSelect={setShowRecallItemSelect}
          recallItems={recallItems}
          selectedLanguageCode={selectedLanguageCode}
          hiddenFields={localSurvey.hiddenFields}
        />
      )}
    </>
  );
};
