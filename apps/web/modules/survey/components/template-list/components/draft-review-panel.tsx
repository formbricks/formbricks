"use client";

import type React from "react";
import type { ReactNode } from "react";
import type { TAiDraftState } from "@/modules/survey/components/template-list/lib/ai-draft-reducer";
import { AiDraftPreview } from "./ai-draft-preview";

type DraftReviewPanelProps = {
  draft: TAiDraftState;
  isGenerating: boolean;
  /** The settled source above the list: a `SourceChip`. */
  source: ReactNode;
  /** Optional facts row between the source and the list (question count, languages…). */
  facts?: ReactNode;
  /** Optional panel below the list (the import report). */
  report?: ReactNode;
  /** The status line / progress ladder while generating. */
  status?: ReactNode;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

/**
 * The review layout Create with AI and Import share: source chip, optional facts, the live question
 * list, optional report, status. Hosts own the footer; this panel is only the body.
 */
export const DraftReviewPanel = ({
  draft,
  isGenerating,
  source,
  facts,
  report,
  status,
  scrollContainerRef,
}: Readonly<DraftReviewPanelProps>) => (
  <>
    <div className="shrink-0">{source}</div>
    {facts ? <div className="shrink-0">{facts}</div> : null}
    <div className="flex min-h-0 flex-1 flex-col">
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
