"use client";

import Link from "next/link";
import { type KeyboardEvent, type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateAIChartAction } from "@/modules/ee/analysis/charts/actions";
import {
  type TAIUnavailableActionType,
  type TAIUnavailableReason,
  getAIUnavailableAction,
} from "@/modules/ee/analysis/charts/lib/ai-availability";
import { getTranslatedAIChartError } from "@/modules/ee/analysis/charts/lib/ai-chart-errors";
import {
  AI_CHART_PROMPT_MAX_LENGTH,
  canGenerateChart,
  getChartHelperPrompts,
} from "@/modules/ee/analysis/charts/lib/ai-chart-prompts";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { AiIcon, AiStatusLine } from "@/modules/ui/components/ai";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";

interface CreateChartWithAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  feedbackDirectoryId: string | null;
  /** Hands the finished chart to the builder, which is where it is reviewed and named. */
  onChartGenerated: (data: AnalyticsResponse) => void;
  /**
   * Owned by the parent so it outlives this dialog. Coming back from the builder to adjust a
   * generation, the prompt that produced the current chart is still there to edit rather than
   * something to remember and retype.
   */
  prompt: string;
  onPromptChange: (prompt: string) => void;
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export function CreateChartWithAIDialog({
  open,
  onOpenChange,
  workspaceId,
  feedbackDirectoryId,
  onChartGenerated,
  prompt,
  onPromptChange,
  isAIAvailable = true,
  aiUnavailableReason,
}: Readonly<CreateChartWithAIDialogProps>) {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const stopButtonRef = useRef<HTMLButtonElement>(null);
  // Survives Stop: a late response from an abandoned run must not open the builder behind the user.
  const runIdRef = useRef(0);

  const helperPrompts = useMemo(() => getChartHelperPrompts(t), [t]);
  const canGenerate = canGenerateChart(prompt, isAIAvailable, isGenerating);

  // A reload mid-generation loses a request the user cannot cheaply recreate.
  useBeforeUnloadPrompt(() => isGenerating);

  // The textarea is disabled while generating, so without this focus is left on a dead control.
  useEffect(() => {
    if (isGenerating) stopButtonRef.current?.focus();
  }, [isGenerating]);

  const translateAIUnavailableMessage = (reason: TAIUnavailableReason | undefined): string => {
    switch (reason) {
      case "not_in_plan":
        return t("workspace.analysis.charts.ai_not_in_plan");
      case "not_enabled":
        return t("workspace.analysis.charts.ai_not_enabled");
      case "instance_not_configured":
        return t("workspace.analysis.charts.ai_instance_not_configured");
      default:
        return t("workspace.analysis.charts.ai_not_available");
    }
  };

  const translateAIUnavailableAction = (actionType: TAIUnavailableActionType): string => {
    switch (actionType) {
      case "enable_ai":
        return t("workspace.analysis.charts.ai_enable_in_settings");
      case "upgrade_plan":
        return t("workspace.analysis.charts.ai_upgrade_plan");
    }
  };

  const aiUnavailableAction = workspace?.organizationId
    ? getAIUnavailableAction(aiUnavailableReason, workspace.organizationId)
    : undefined;

  const closeAndReset = () => {
    runIdRef.current += 1;
    setIsGenerating(false);
    onOpenChange(false);
  };

  const setDialogOpen = (nextOpen: boolean) => {
    // Closing mid-generation throws away work the user is waiting on, so it asks first — the same
    // warning a page reload already gives.
    if (!nextOpen && isGenerating) {
      setIsConfirmingDiscard(true);
      return;
    }

    if (!nextOpen) {
      closeAndReset();
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleStop = () => {
    // The server action cannot be aborted, so this abandons the result rather than the request.
    runIdRef.current += 1;
    setIsGenerating(false);
  };

  const handleGenerate = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canGenerate || !feedbackDirectoryId) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setIsGenerating(true);

    try {
      const result = await generateAIChartAction({
        workspaceId,
        prompt: prompt.trim(),
        feedbackDirectoryId,
      });

      // Stopped, or the dialog was closed and reopened: this result is no longer wanted.
      if (runIdRef.current !== runId) return;

      if (result?.data) {
        setIsGenerating(false);
        onOpenChange(false);
        onChartGenerated(result.data);
        return;
      }

      toast.error(getTranslatedAIChartError(getFormattedErrorMessage(result), t));
      setIsGenerating(false);
    } catch (error: unknown) {
      if (runIdRef.current !== runId) return;
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong_please_try_again"));
      setIsGenerating(false);
    }
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogContent
        width="narrow"
        className="overflow-hidden"
        // A stray click outside must not abandon a generation, but Escape should still work.
        disableCloseOnOutsideClick
        closeOnEscape
        onOpenAutoFocus={(event) => {
          if (!isAIAvailable) return;
          event.preventDefault();
          globalThis.requestAnimationFrame(() => promptInputRef.current?.focus());
        }}>
        <DialogHeader>
          {/* DialogHeader colours its icon through an arbitrary variant that outranks the kit's own
              token, so the mark asserts it here. */}
          <AiIcon aria-hidden="true" className="text-ai-dark!" />
          <DialogTitle>{t("workspace.analysis.charts.ai_create.dialog_title")}</DialogTitle>
          <DialogDescription>{t("workspace.analysis.charts.ai_create.dialog_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="-mx-1 -mt-1 space-y-4 px-1 pt-1 pb-1">
          <form className="flex w-full flex-col space-y-4" onSubmit={handleGenerate}>
            {!isAIAvailable && (
              <Alert variant="info" role="status">
                <AlertTitle>{t("workspace.analysis.charts.ai_chart_generation")}</AlertTitle>
                <AlertDescription>{translateAIUnavailableMessage(aiUnavailableReason)}</AlertDescription>
                {aiUnavailableAction && (
                  <AlertButton asChild>
                    <Link href={aiUnavailableAction.href}>
                      {translateAIUnavailableAction(aiUnavailableAction.type)}
                    </Link>
                  </AlertButton>
                )}
              </Alert>
            )}

            <div className="space-y-2">
              <textarea
                ref={promptInputRef}
                id="ai-chart-prompt"
                className="min-h-24 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                maxLength={AI_CHART_PROMPT_MAX_LENGTH}
                placeholder={t("workspace.analysis.charts.ai_create.prompt_placeholder")}
                value={prompt}
                disabled={!isAIAvailable || isGenerating}
                onChange={(event) => onPromptChange(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                aria-label={t("workspace.analysis.charts.ai_create.prompt_label")}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {t("workspace.analysis.charts.ai_create.characters", {
                    count: prompt.length,
                    max: AI_CHART_PROMPT_MAX_LENGTH,
                  })}
                </span>
                <span>{t("workspace.analysis.charts.ai_create.shortcut_hint")}</span>
              </div>
            </div>

            {isAIAvailable && !isGenerating && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  {t("workspace.analysis.charts.ai_create.try_prompt")}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {helperPrompts.map((helperPrompt) => (
                    <Button
                      key={helperPrompt.label}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="group w-full min-w-0 justify-start text-left"
                      title={helperPrompt.prompt}
                      aria-label={`${helperPrompt.label}. ${helperPrompt.prompt}`}
                      onClick={() => onPromptChange(helperPrompt.prompt)}>
                      <helperPrompt.Icon className="size-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-primary" />
                      <span className="min-w-0 truncate">{helperPrompt.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <AiStatusLine
              isActive={isGenerating}
              messages={[
                t("workspace.analysis.charts.ai_status_reading"),
                t("workspace.analysis.charts.ai_status_choosing"),
                t("workspace.analysis.charts.ai_status_querying"),
              ]}
            />

            <DialogFooter>
              {isGenerating ? (
                // One action while generating: a disabled primary beside it only invites clicking.
                <Button ref={stopButtonRef} type="button" variant="secondary" onClick={handleStop}>
                  {t("workspace.surveys.ai_create.stop")}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" variant="ai-primary" disabled={!canGenerate}>
                    <AiIcon tone="ai-light" />
                    {t("workspace.analysis.charts.ai_create.generate")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>

      <ConfirmationModal
        open={isConfirmingDiscard}
        setOpen={setIsConfirmingDiscard}
        title={t("workspace.analysis.charts.ai_create.discard_generation_title")}
        body={t("workspace.analysis.charts.ai_create.discard_generation_body")}
        buttonText={t("workspace.surveys.ai_create.discard")}
        buttonVariant="destructive"
        cancelButtonText={t("workspace.surveys.ai_create.keep_editing")}
        onConfirm={() => {
          setIsConfirmingDiscard(false);
          closeAndReset();
        }}
      />
    </Dialog>
  );
}
