"use client";

import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";

/**
 * Single Jotai store for the workflow detail layout — wraps both the page header CTA (Archive /
 * Save buttons + status badge) and the page content so they read and write the same atoms.
 */
export const WorkflowEditorProvider = ({ children }: { children: ReactNode }) => (
  <JotaiProvider>{children}</JotaiProvider>
);
