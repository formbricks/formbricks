"use client";

import type React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { TAiDraftState } from "@/modules/survey/components/template-list/lib/ai-draft-reducer";
import { AiDraftPreview } from "./ai-draft-preview";

type DraftReviewPanelProps = {
  draft: TAiDraftState;
  isGenerating: boolean;
  /** The settled source above the list: a `SourceChip`. */
  source: ReactNode;
  /** Optional choice about the source, between it and the list (Import's Update or Create new). */
  decision?: ReactNode;
  /** Optional panel below the list (the import report). */
  report?: ReactNode;
  /** The status line / progress ladder while generating. */
  status?: ReactNode;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Extra classes for the list's wrapper: a host whose body scrolls gives the list a minimum height. */
  listClassName?: string;
};

/**
 * The review layout Create with AI and Import share: source chip, an optional decision, the live question
 * list, optional report, status. Hosts own the footer; this panel is only the body.
 */
export const DraftReviewPanel = ({
  draft,
  isGenerating,
  source,
  decision,
  report,
  status,
  scrollContainerRef,
  listClassName,
}: Readonly<DraftReviewPanelProps>) => (
  <>
    <div className="shrink-0">{source}</div>
    {decision ? <div className="shrink-0">{decision}</div> : null}
    <div className={cn("flex min-h-0 flex-1 flex-col", listClassName)}>
      <AiDraftPreview
        draft={draft}
        isGenerating={isGenerating}
        className="flex-1"
        scrollContainerRef={scrollContainerRef}
      />
    </div>
    {report ? <div className="shrink-0">{report}</div> : null}
    {status}
  </>
);
