"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import { useCreativesAccess } from "../components/creatives-access-provider";
import { isCreativesVisible } from "../lib/access-rules";
import {
  type TSurveyLinkedCreative,
  type TSurveyStatusChangePlan,
  planSurveyStatusChange,
  shouldKeepCreativesPaused,
} from "../lib/survey-side";
import {
  pauseSurveyCreatives,
  surveyLinkedCreativesKeys,
  surveyLinkedCreativesQuery,
} from "../lib/survey-side-api";

const NO_CREATIVES: TSurveyLinkedCreative[] = [];

type TSurveyRef = Readonly<{ workspaceId: string; surveyId: string }>;

// How long creatives a page read on the server count as fresh: no second fetch on load, and a later
// focus or remount still picks up creatives linked elsewhere since.
const SERVER_LOADED_STALE_TIME_MS = 60_000;

/**
 * The creatives that open the survey. Empty while loading or when they can't be read: every screen
 * using it only adds an explanation or locks a switch the server guards anyway. A page that read them
 * on the server (`getSurveyLinkedCreatives`) passes them as `initialData`. Also empty, and never read,
 * when the workspace has no Creatives access (ENG-6602): the survey screens show no creative UI then.
 */
export const useSurveyLinkedCreatives = ({
  workspaceId,
  surveyId,
  enabled = true,
  initialData,
}: TSurveyRef & {
  enabled?: boolean;
  initialData?: TSurveyLinkedCreative[];
}): TSurveyLinkedCreative[] => {
  const isVisible = isCreativesVisible(useCreativesAccess());
  const { data } = useQuery({
    ...surveyLinkedCreativesQuery({ workspaceId, surveyId }),
    enabled: enabled && isVisible,
    ...(initialData && { initialData, staleTime: SERVER_LOADED_STALE_TIME_MS }),
  });
  return isVisible ? (data ?? NO_CREATIVES) : NO_CREATIVES;
};

type TPendingStatusChange = Readonly<{
  to: TSurveyStatus;
  plan: TSurveyStatusChangePlan;
  keepPaused: boolean;
}>;

/**
 * A survey status change that first names the creatives it pauses or brings back: it applies
 * at once when none are affected, and otherwise waits for the dialog. A resume that keeps them paused
 * pauses those creatives before the survey goes live, so none of them shows in between. Without
 * Creatives access there are none to name, so it applies at once.
 */
export const useSurveyStatusChangeWithCreatives = ({
  workspaceId,
  surveyId,
  currentStatus,
  applyStatus,
}: TSurveyRef & {
  currentStatus: TSurveyStatus;
  /** Changes the survey's status and reports the outcome itself. */
  applyStatus: (status: TSurveyStatus) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isVisible = isCreativesVisible(useCreativesAccess());
  // The last change asked for stays after the dialog closes, so its copy doesn't change mid-fade.
  const [pending, setPending] = useState<TPendingStatusChange | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshLinkedCreatives = () =>
    queryClient.invalidateQueries({ queryKey: surveyLinkedCreativesKeys.survey(surveyId) });

  const loadLinkedCreatives = async (): Promise<TSurveyLinkedCreative[]> => {
    if (!isVisible) return NO_CREATIVES;
    try {
      return await queryClient.fetchQuery({
        ...surveyLinkedCreativesQuery({ workspaceId, surveyId }),
        staleTime: 0,
      });
    } catch {
      // Naming the creatives explains the change; failing to read them must not block it.
      return NO_CREATIVES;
    }
  };

  const requestStatusChange = async (to: TSurveyStatus) => {
    const plan = planSurveyStatusChange({
      from: currentStatus,
      to,
      creatives: await loadLinkedCreatives(),
      now: new Date(),
    });
    if (plan) {
      setPending({ to, plan, keepPaused: false });
      setIsOpen(true);
      return;
    }
    await applyStatus(to);
    void refreshLinkedCreatives();
  };

  const confirm = async () => {
    if (!pending) return;
    setIsSubmitting(true);
    try {
      if (shouldKeepCreativesPaused(pending.plan, pending.keepPaused)) {
        await pauseSurveyCreatives({ workspaceId, surveyId });
      }
    } catch {
      // The dialog stays open: the author can retry, or resume without keeping them paused.
      toast.error(t("workspace.creatives.survey_side.keep_paused_failed"));
      setIsSubmitting(false);
      void refreshLinkedCreatives();
      return;
    }
    setIsOpen(false);
    await applyStatus(pending.to);
    setIsSubmitting(false);
    void refreshLinkedCreatives();
  };

  return {
    requestStatusChange,
    dialog: {
      plan: pending?.plan ?? null,
      keepPaused: pending?.keepPaused ?? false,
      setKeepPaused: (keepPaused: boolean) =>
        setPending((current) => (current ? { ...current, keepPaused } : current)),
      open: isOpen,
      setOpen: ((value) => {
        const open = typeof value === "function" ? value(isOpen) : value;
        if (!open && !isSubmitting) setIsOpen(false);
      }) satisfies Dispatch<SetStateAction<boolean>>,
      onConfirm: confirm,
      isSubmitting,
    },
  };
};
