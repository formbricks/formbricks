"use client";

import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";

export const WorkflowEditorProvider = ({ children }: { children: ReactNode }) => (
  <JotaiProvider>{children}</JotaiProvider>
);
