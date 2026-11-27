"use client";

import { createContext, useContext } from "react";
import { TEditorIssue, getFieldIssue } from "@/modules/survey/editor/lib/validation-issues";

const NO_ISSUES: TEditorIssue[] = [];

const EditorIssuesContext = createContext<TEditorIssue[]>(NO_ISSUES);

/**
 * The editor's current issues, for any field to read without every question form passing them down.
 * Outside the editor there are none.
 */
export const EditorIssuesProvider = EditorIssuesContext.Provider;

export const useEditorIssues = (): TEditorIssue[] => useContext(EditorIssuesContext);

/** The issue on one field of one card, if there is one. */
export const useFieldIssue = (
  targetId: string | undefined,
  field: string | null
): TEditorIssue | undefined => {
  const issues = useEditorIssues();
  return targetId ? getFieldIssue(issues, targetId, field) : undefined;
};
