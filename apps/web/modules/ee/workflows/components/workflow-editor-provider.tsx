"use client";

import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";

interface WorkflowEditorProviderProps {
  children: ReactNode;
}

export const WorkflowEditorProvider = ({ children }: Readonly<WorkflowEditorProviderProps>) => (
  <JotaiProvider>{children}</JotaiProvider>
);
