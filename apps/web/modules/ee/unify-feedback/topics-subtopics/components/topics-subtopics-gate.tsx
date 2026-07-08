"use client";

import { Loader2Icon, MessageSquareDashedIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface TopicsSubtopicsGateProps {
  variant: "insufficient" | "embedding";
  workspaceId: string;
  /** Current progress numerator (records collected, or records embedded). */
  current: number;
  /** Progress denominator (the 750 threshold, or the total open-text records). */
  total: number;
  directoryMap: Record<string, string>;
  directoryId: string;
  onDirectoryChange: (directoryId: string) => void;
}

export const TopicsSubtopicsGate = ({
  variant,
  workspaceId,
  current,
  total,
  directoryMap,
  directoryId,
  onDirectoryChange,
}: Readonly<TopicsSubtopicsGateProps>) => {
  const { t } = useTranslation();
  const directoryIds = Object.keys(directoryMap);
  const showDirectorySelector = directoryIds.length > 1;
  const progress = total > 0 ? current / total : 0;

  const isInsufficient = variant === "insufficient";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
      {showDirectorySelector && (
        <div className="mb-6 flex justify-center">
          <div className="w-full max-w-xs space-y-1">
            <span className="block text-xs font-medium text-slate-600">
              {t("workspace.unify.feedback_directory")}
            </span>
            <Select value={directoryId} onValueChange={onDirectoryChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("workspace.unify.select_feedback_directory")} />
              </SelectTrigger>
              <SelectContent>
                {directoryIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {directoryMap[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        {isInsufficient ? (
          <MessageSquareDashedIcon className="size-8 text-slate-400" />
        ) : (
          <Loader2Icon className="size-8 animate-spin text-slate-400" />
        )}

        <h2 className="text-lg font-semibold text-slate-900">
          {isInsufficient
            ? t("workspace.unify.taxonomy_gate_insufficient_title")
            : t("workspace.unify.taxonomy_gate_embedding_title")}
        </h2>

        <p className="text-sm text-balance text-slate-600">
          {isInsufficient
            ? t("workspace.unify.taxonomy_gate_insufficient_description", { min: total })
            : t("workspace.unify.taxonomy_gate_embedding_description")}
        </p>

        <GateProgress>
          <ProgressBar progress={progress} barColor="bg-brand-dark" height={2} />
          <p className="text-xs font-medium text-slate-500">
            {isInsufficient
              ? t("workspace.unify.taxonomy_gate_records_progress", {
                  current: current.toLocaleString(),
                  min: total.toLocaleString(),
                })
              : t("workspace.unify.taxonomy_gate_embedding_progress", {
                  current: current.toLocaleString(),
                  total: total.toLocaleString(),
                })}
          </p>
        </GateProgress>

        {isInsufficient && (
          <Button asChild size="sm">
            <Link href={`/workspaces/${workspaceId}/unify/sources`}>
              {t("workspace.unify.taxonomy_gate_setup_sources")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

const GateProgress = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div className="mt-2 w-full max-w-sm space-y-2">{children}</div>
);
