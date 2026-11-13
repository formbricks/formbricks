"use client";

import type { ReactNode } from "react";
import type { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getRecallItemLabel, getRecallItems } from "@/lib/utils/recall";
import { RecallItemSelect } from "@/modules/survey/components/element-form-input/components/recall-item-select";

export interface TEditorRecallPickerProps {
  /** Items already in the text, which a picker may leave out. */
  recallItems: TSurveyRecallItem[];
  addRecallItem: (item: TSurveyRecallItem) => void;
  setShowRecallItemSelect: (show: boolean) => void;
}

/**
 * Where the editor's `@` recall gets its items: what a token in the text is called, and the menu
 * that inserts a new one. A survey field uses `createSurveyRecallSource`; a workflow step brings its
 * Variable picker (ENG-7113).
 */
export interface TEditorRecallSource {
  /** Recall items for the complete tokens in `text`. A token without an item is dropped from the text. */
  getRecallItems: (text: string) => TSurveyRecallItem[];
  /** The current label of a token's id, so a chip follows a rename; undefined keeps its label. */
  getRecallItemLabel: (id: string) => string | undefined;
  renderPicker: (props: TEditorRecallPickerProps) => ReactNode;
}

/** The survey recall the editor has always had: questions, Embedded Data and auto-captured fields. */
export const createSurveyRecallSource = (
  localSurvey: TSurvey,
  elementId: string,
  selectedLanguageCode: string
): TEditorRecallSource => ({
  getRecallItems: (text) => getRecallItems(text, localSurvey, selectedLanguageCode),
  getRecallItemLabel: (id) => getRecallItemLabel(id, localSurvey, selectedLanguageCode),
  renderPicker: ({ recallItems, addRecallItem, setShowRecallItemSelect }) => (
    <RecallItemSelect
      localSurvey={localSurvey}
      elementId={elementId}
      addRecallItem={addRecallItem}
      setShowRecallItemSelect={setShowRecallItemSelect}
      recallItems={recallItems}
      selectedLanguageCode={selectedLanguageCode}
    />
  ),
});
