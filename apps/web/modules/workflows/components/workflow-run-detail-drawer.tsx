"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { IdBadge } from "@/modules/ui/components/id-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/modules/ui/components/sheet";
import { type TPlaceholderWorkflowRunListItem } from "../lib/placeholder-data";

const JsonBlock = ({ value }: Readonly<{ value: unknown }>) => {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("common.copied_to_clipboard"));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t("common.copy")}
        className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100">
        {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </button>
      <pre className="overflow-auto rounded-lg bg-slate-950 p-4 pr-10 text-xs leading-6 text-slate-100">
        {text}
      </pre>
    </div>
  );
};

interface WorkflowRunDetailDrawerProps {
  run: TPlaceholderWorkflowRunListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkflowRunDetailDrawer = ({
  run,
  open,
  onOpenChange,
}: Readonly<WorkflowRunDetailDrawerProps>) => {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-white px-5 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{run?.workflowName ?? t("common.workflow_runs")}</SheetTitle>
          <SheetDescription>{run?.description}</SheetDescription>
        </SheetHeader>

        {run ? (
          <div className="space-y-6 py-4">
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.summary")}</h2>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-slate-500">{t("common.id")}</dt>
                  <dd className="mt-1">
                    <IdBadge id={run.id} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("common.status")}</dt>
                  <dd className="mt-1">
                    <Badge text={run.statusLabel} type={run.statusType} size="normal" />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("common.started_at")}</dt>
                  <dd className="text-slate-900">{run.createdAtLabel}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("common.finished_at")}</dt>
                  <dd className="text-slate-900">{run.timeLabel}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.metadata")}</h2>
              <JsonBlock
                value={{
                  mode: run.mode,
                  responseId: run.responseId,
                  trigger: run.trigger,
                  workflowId: run.workflowId,
                }}
              />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.activity")}</h2>
              <JsonBlock value={run.logs} />
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
