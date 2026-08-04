"use client";

import { type ReactNode, createContext, useContext } from "react";
import type { TWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/types/email-authoring-context";

const WorkflowEmailAuthoringCtx = createContext<TWorkflowEmailAuthoringContext | null>(null);

/**
 * Provides the server-resolved survey/team/sender context to the workflow node inspector so the
 * `send_email` form can render Follow-Ups-parity controls (recall body, recipient options) without
 * re-fetching. Wraps the builder body; the trigger `surveyId` inside the definition atom is matched
 * against `survey.id` by the consumer so stale (survey-switched) context degrades gracefully.
 */
export const WorkflowEmailAuthoringProvider = ({
  value,
  children,
}: Readonly<{ value: TWorkflowEmailAuthoringContext; children: ReactNode }>) => (
  <WorkflowEmailAuthoringCtx.Provider value={value}>{children}</WorkflowEmailAuthoringCtx.Provider>
);

/** Returns the workflow email authoring context, or `null` when rendered outside the provider. */
export const useWorkflowEmailAuthoringContext = (): TWorkflowEmailAuthoringContext | null =>
  useContext(WorkflowEmailAuthoringCtx);
