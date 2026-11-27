"use client";

import { CircleAlertIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Label } from "@/modules/ui/components/label";
import { useContactDirectoryTargetedSurveys } from "../hooks/use-contact-directories";
import type {
  TContactDirectory,
  TContactDirectoryTargetedSurvey,
  TContactDirectoryWorkspaceRef,
} from "../types";

interface ContactDirectoryRemovalDialogProps {
  directory: TContactDirectory;
  removed: TContactDirectoryWorkspaceRef[];
  isSaving: boolean;
  onBack: () => void;
  /** Called with the removed workspaces whose targeted surveys should be paused. */
  onConfirm: (choice: { pauseSurveysInWorkspaceIds: string[] }) => void;
}

/** The running surveys that stop reaching anyone, with "Pause these surveys". Only shown when there are some. */
const WorkspaceSurveys = ({
  workspace,
  surveys,
  totalCount,
  paused,
  onPausedChange,
}: Readonly<{
  workspace: TContactDirectoryWorkspaceRef;
  surveys: TContactDirectoryTargetedSurvey[];
  /** All of the workspace's targeted surveys; the list holds only the first ones. */
  totalCount: number;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
}>) => {
  const { t } = useTranslation();
  const checkboxId = `contact-directory-pause-${workspace.id}`;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-900">
        {t("workspace.settings.contact_directories.targeted_surveys_heading")}
      </p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
        {surveys.map((survey) => (
          <li key={survey.id}>
            {survey.name}
            {survey.status === "scheduled" ? (
              <span className="text-slate-500"> · {t("common.scheduled")}</span>
            ) : null}
          </li>
        ))}
        {totalCount > surveys.length ? (
          <li className="text-slate-500">
            {t("workspace.settings.contact_directories.targeted_surveys_more", {
              count: totalCount - surveys.length,
            })}
          </li>
        ) : null}
      </ul>
      <p className="text-sm text-slate-500">
        {t("workspace.settings.contact_directories.targeted_surveys_reach_no_one")}
      </p>
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={paused}
          onCheckedChange={(checked) => onPausedChange(checked === true)}
        />
        <Label htmlFor={checkboxId} className="font-normal">
          {t("workspace.settings.contact_directories.pause_these_surveys")}
        </Label>
      </div>
    </div>
  );
};

/**
 * The confirm step of a Manage save that removes workspaces (decision 2): per removed workspace, what
 * changes, the running surveys that stop reaching anyone, and a "Pause these surveys" box ticked by
 * default. The removal never archives the directory; that is the Archive button's own action (ADR 0062).
 * Opens over the Manage dialog, as Feedback Datasets confirm a workspace change.
 */
export const ContactDirectoryRemovalDialog = ({
  directory,
  removed,
  isSaving,
  onBack,
  onConfirm,
}: Readonly<ContactDirectoryRemovalDialogProps>) => {
  const { t, i18n } = useTranslation();
  const targeted = useContactDirectoryTargetedSurveys({ directoryId: directory.id, enabled: true });
  // A reopened dialog first shows the list cached from last time while it refetches. Only a finished fetch
  // from this opening counts, or a survey started since then would be removed without being paused.
  const isCurrent = targeted.isSuccess && targeted.fetchStatus === "idle";
  // Workspaces whose box was unticked; every box starts ticked.
  const [keptRunning, setKeptRunning] = useState<Set<string>>(() => new Set());

  const entryOf = (workspaceId: string) =>
    targeted.data?.workspaces.find((entry) => entry.workspaceId === workspaceId);
  const surveysOf = (workspaceId: string): TContactDirectoryTargetedSurvey[] =>
    entryOf(workspaceId)?.surveys ?? [];

  const setPaused = (workspaceId: string, paused: boolean) =>
    setKeptRunning((previous) => {
      const next = new Set(previous);
      if (paused) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });

  const workspaceNames = new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(
    removed.map(({ name }) => name)
  );
  const titleValues = { workspaceNames, directoryName: directory.name, count: removed.length };

  /** The bullet on targeted surveys: loading, or none. Running ones get their own block below the list. */
  const renderSurveysBullet = (workspaceId: string) => {
    if (targeted.isError) return null;
    if (!isCurrent) return <li className="text-slate-500">{t("common.loading")}</li>;
    if (surveysOf(workspaceId).length > 0) return null;
    return <li>{t("workspace.settings.contact_directories.no_targeted_surveys")}</li>;
  };

  const renderSurveys = (workspace: TContactDirectoryWorkspaceRef) => {
    if (targeted.isError || !isCurrent || surveysOf(workspace.id).length === 0) return null;
    return (
      <WorkspaceSurveys
        workspace={workspace}
        surveys={surveysOf(workspace.id)}
        totalCount={entryOf(workspace.id)?.totalCount ?? 0}
        paused={!keptRunning.has(workspace.id)}
        onPausedChange={(paused) => setPaused(workspace.id, paused)}
      />
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onBack()}>
      <DialogContent hideCloseButton disableCloseOnOutsideClick>
        <DialogHeader>
          <CircleAlertIcon aria-hidden="true" />
          <DialogTitle>
            {t("workspace.settings.contact_directories.remove_workspaces_title", titleValues)}
          </DialogTitle>
          <DialogDescription>
            {t("workspace.settings.contact_directories.removal_keeps_data")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {targeted.isError ? (
            <Alert variant="error">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                {getV3ApiErrorMessage(
                  targeted.error,
                  t("workspace.settings.contact_directories.targeted_surveys_load_failed")
                )}
                <Button variant="secondary" size="sm" onClick={() => targeted.refetch()}>
                  {t("common.try_again")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {removed.map((workspace) => (
            <section
              key={workspace.id}
              aria-label={workspace.name}
              className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {/* Several workspaces each get a box, so each names its workspace. */}
                {removed.length === 1
                  ? t("workspace.settings.contact_directories.removal_effects_heading")
                  : t("workspace.settings.contact_directories.removal_effects_heading_named", {
                      workspaceName: workspace.name,
                    })}
              </h3>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                <li>{t("workspace.settings.contact_directories.removal_effect_pages")}</li>
                <li>{t("workspace.settings.contact_directories.removal_effect_identify")}</li>
                <li>{t("workspace.settings.contact_directories.removal_effect_responses")}</li>
                {renderSurveysBullet(workspace.id)}
              </ul>
              {renderSurveys(workspace)}
            </section>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onBack} disabled={isSaving}>
            {t("common.back")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={isSaving}
            disabled={!isCurrent}
            onClick={() =>
              onConfirm({
                pauseSurveysInWorkspaceIds: removed
                  .map(({ id }) => id)
                  .filter((id) => !keptRunning.has(id) && surveysOf(id).length > 0),
              })
            }>
            {t("workspace.settings.contact_directories.remove_workspaces", {
              directoryName: directory.name,
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
