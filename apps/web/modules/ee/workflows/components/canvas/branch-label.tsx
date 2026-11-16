"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TWorkflowCanvasBranch } from "@/modules/ee/workflows/state/editor";

interface BranchLabelProps {
  branch: TWorkflowCanvasBranch;
  /** The branch the run open in the run drawer took: filled. */
  isTaken: boolean;
  /** Another branch of the same step was taken: greyed. */
  isDimmed: boolean;
  /** Left to right, the label sits on a shorter horizontal leg, so it is cut sooner. */
  isCompact?: boolean;
}

/**
 * A branch's plain label (ED8: Then and Else, or a Switch case's name and Default), drawn on the
 * branch's line midway between the fork bar and the branch's first step or its `+`.
 */
export const BranchLabel = ({ branch, isTaken, isDimmed, isCompact = false }: Readonly<BranchLabelProps>) => {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-slate-500 bg-white px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-900",
        isCompact ? "max-w-[9rem]" : "max-w-[18rem]",
        isTaken && "border-slate-900 bg-slate-900 text-white",
        isDimmed && "opacity-40"
      )}>
      <span aria-hidden="true" className="truncate">
        {branch.label}
      </span>
      <span className="sr-only">{branch.ariaLabel}</span>
      {isTaken ? <span className="sr-only">{t("workspace.workflows.run_branch_taken_aria")}</span> : null}
    </span>
  );
};
