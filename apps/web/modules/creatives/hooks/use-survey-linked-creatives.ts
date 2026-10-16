"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  type TSurveyLinkedCreative,
  type TSurveyStatusChangePlan,
  getCreativesToKeepPaused,
  planSurveyStatusChange,
} from "../lib/survey-side";
import { pauseCreative, surveyLinkedCreativesKeys, surveyLinkedCreativesQuery } from "../lib/survey-side-api";

const NO_CREATIVES: TSurveyLinkedCreative[] = [];

type TSurveyRef = Readonly<{ workspaceId: string; surveyId: string }>;

/**
 * The creatives that open the survey. Empty while loading or when they can't be read: every screen
 * using it only adds an explanation or locks a switch the server guards anyway.
 */
export const useSurveyLinkedCreatives = ({
  workspaceId,
  surveyId,
  enabled = true,
}: TSurveyRef & {
  enabled?: boolean;
}): TSurveyLinkedCreative[] => {
  const { data } = useQuery({ ...surveyLinkedCreativesQuery({ workspaceId, surveyId }), enabled });
  return data ?? NO_CREATIVES;
};

type TPendingStatusChange = Readonly<{
  to: TSurveyStatus;
  plan: TSurveyStatusChangePlan;
  keepPaused: boolean;
}>;

/**
 * A survey status change that first names the creatives it pauses or brings back (T6, Δ4): it applies
 * at once when none are affected, and otherwise waits for the dialog. A resume that keeps them paused
 * pauses those creatives before the survey goes live, so none of them shows in between.
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
  const [pending, setPending] = useState<TPendingStatusChange | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshLinkedCreatives = () =>
    queryClient.invalidateQueries({ queryKey: surveyLinkedCreativesKeys.survey(surveyId) });

  const loadLinkedCreatives = async (): Promise<TSurveyLinkedCreative[]> => {
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
      return;
    }
    await applyStatus(to);
    void refreshLinkedCreatives();
  };

  const confirm = async () => {
    if (!pending) return;
    setIsSubmitting(true);
    try {
      await Promise.all(getCreativesToKeepPaused(pending.plan, pending.keepPaused).map(pauseCreative));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.creatives.survey_side.keep_paused_failed")));
      setIsSubmitting(false);
      void refreshLinkedCreatives();
      return;
    }
    setPending(null);
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
      open: pending !== null,
      setOpen: ((value) => {
        const open = typeof value === "function" ? value(pending !== null) : value;
        if (!open && !isSubmitting) setPending(null);
      }) satisfies Dispatch<SetStateAction<boolean>>,
      onConfirm: confirm,
      isSubmitting,
    },
  };
};
