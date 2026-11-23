"use client";

import type { ReactNode } from "react";
import { Alert } from "@/modules/ui/components/alert";

/**
 * A compact alert for the editor's panels whose message wraps onto as many lines as it needs. The
 * small Alert's AlertDescription cuts its text to one line, and these messages end with what to do
 * ("Fix the problems shown on the canvas"), the part a cut line hides.
 */
export const WorkflowAlert = ({
  variant,
  alertRole,
  children,
}: Readonly<{
  variant: "error" | "warning" | "info";
  alertRole?: "alert" | "status";
  children: ReactNode;
}>) => (
  // Icon at the first line rather than centered on a message of several lines.
  <Alert variant={variant} size="small" alertRole={alertRole} className="items-start">
    <div className="min-w-0">{children}</div>
  </Alert>
);
