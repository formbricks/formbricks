"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BookUserIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { FormProvider, type SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Muted } from "@/modules/ui/components/typography";
import { useCreateContactDirectory, useUpdateContactDirectory } from "../hooks/use-contact-directories";
import { CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES } from "../lib/constants";
import {
  type TContactDirectoryDialogMode,
  type TContactDirectoryFormData,
  getContactDirectoryErrorMessage,
  getContactDirectoryFormSchema,
} from "../lib/directory-form";
import { getDirectorySaveEffect, getWorkspacePickerOptions } from "../lib/display";
import type {
  TContactDirectory,
  TContactDirectoryList,
  TContactDirectoryMatchingKey,
  TContactDirectoryUpdateInput,
} from "../types";
import { ContactDirectoryRemovalDialog } from "./contact-directory-removal-dialog";

const MATCHING_KEY_TOGGLE_ID = "contact-directory-matching-key";

interface ContactDirectoryDialogProps {
  organizationId: string;
  list: TContactDirectoryList;
  /** The directory to manage; omitted to create one. */
  directory?: TContactDirectory;
  onClose: () => void;
}

const getDialogMode = (directory: TContactDirectory | undefined): TContactDirectoryDialogMode => {
  if (!directory) return "create";
  return directory.isArchived ? "unarchive" : "manage";
};

/**
 * Create, Manage and Unarchive share one dialog (spec decision 20): name, matching key (fixed once created)
 * and workspaces. Taking a workspace's chip off removes it on Save, after a confirm step; an archived
 * directory opens here, and its Save unarchives it, with or without workspaces. Mount it only while open, so
 * each opening starts from the directory as the list has it.
 */
export const ContactDirectoryDialog = ({
  organizationId,
  list,
  directory,
  onClose,
}: Readonly<ContactDirectoryDialogProps>) => {
  const { t } = useTranslation();
  const createDirectory = useCreateContactDirectory({ organizationId });
  const updateDirectory = useUpdateContactDirectory({ organizationId });
  const mode = getDialogMode(directory);
  // The form data waiting on the confirm step, while a save would remove workspaces.
  const [pendingRemoval, setPendingRemoval] = useState<TContactDirectoryFormData | null>(null);

  const initialWorkspaceIds = useMemo(
    () => directory?.workspaces.map(({ id }) => id) ?? [],
    [directory?.workspaces]
  );

  const form = useForm<TContactDirectoryFormData>({
    resolver: zodResolver(getContactDirectoryFormSchema(t, mode)),
    mode: "onChange",
    defaultValues: {
      name: directory?.name ?? "",
      matchingKey: directory?.matchingKey ?? "email",
      workspaceIds: initialWorkspaceIds,
    },
  });
  const { control, handleSubmit, setError, setValue } = form;
  const workspaceIds = useWatch({ control, name: "workspaceIds" });
  const matchingKey = useWatch({ control, name: "matchingKey" });

  const workspaceOptions = useMemo(
    () => getWorkspacePickerOptions({ list, t, currentDirectoryId: directory?.id }),
    [list, t, directory?.id]
  );
  const pendingEffect = pendingRemoval
    ? getDirectorySaveEffect(directory, pendingRemoval.workspaceIds)
    : null;

  const isSaving = createDirectory.isPending || updateDirectory.isPending;
  const canArchive = mode === "manage" && initialWorkspaceIds.length === 0;

  const handleSaveError = (error: unknown) => {
    setPendingRemoval(null);
    const message = getContactDirectoryErrorMessage(error, t);
    // A taken name belongs to the field; anything else is about the whole save.
    if (error instanceof V3ApiError && error.code === "contact_directory_name_taken") {
      setError("name", { message });
      return;
    }
    toast.error(message);
  };

  // A save never archives (ADR 0062): only the Archive button does, once no workspaces are left.
  const saveChanges = (
    data: TContactDirectoryFormData,
    { pauseSurveysInWorkspaceIds = [] }: { pauseSurveysInWorkspaceIds?: string[] } = {}
  ) => {
    if (!directory) return;
    const input: TContactDirectoryUpdateInput = { name: data.name.trim(), workspaceIds: data.workspaceIds };
    if (mode === "unarchive") input.isArchived = false;
    if (pauseSurveysInWorkspaceIds.length > 0) input.pauseSurveysInWorkspaceIds = pauseSurveysInWorkspaceIds;

    const successMessage =
      mode === "unarchive"
        ? t("workspace.settings.contact_directories.directory_unarchived")
        : t("workspace.settings.contact_directories.directory_updated");

    updateDirectory.mutate(
      { directoryId: directory.id, input },
      {
        onSuccess: () => {
          toast.success(successMessage);
          onClose();
        },
        onError: handleSaveError,
      }
    );
  };

  const archiveDirectory = () => {
    if (!directory || !canArchive) return;
    updateDirectory.mutate(
      { directoryId: directory.id, input: { isArchived: true } },
      {
        onSuccess: () => {
          toast.success(t("workspace.settings.contact_directories.directory_archived"));
          onClose();
        },
        onError: handleSaveError,
      }
    );
  };

  const onSubmit: SubmitHandler<TContactDirectoryFormData> = (data) => {
    if (directory) {
      // Decision 2: removing a workspace is confirmed first, with what it changes.
      if (getDirectorySaveEffect(directory, data.workspaceIds).removed.length > 0) {
        setPendingRemoval(data);
        return;
      }
      saveChanges(data);
      return;
    }
    createDirectory.mutate(
      { name: data.name.trim(), matchingKey: data.matchingKey, workspaceIds: data.workspaceIds },
      {
        onSuccess: () => {
          toast.success(t("workspace.settings.contact_directories.directory_created"));
          onClose();
        },
        onError: handleSaveError,
      }
    );
  };

  const getTitle = () => {
    if (mode === "create") return t("workspace.settings.contact_directories.create_directory");
    if (mode === "unarchive") return t("workspace.settings.contact_directories.unarchive_directory");
    return t("workspace.settings.contact_directories.manage_directory");
  };

  const getSubmitLabel = () => {
    if (mode === "create") return t("workspace.settings.contact_directories.create_directory");
    if (mode === "unarchive") return t("common.unarchive");
    return t("common.save");
  };

  const sharedContactsNote =
    matchingKey === "userId"
      ? t("workspace.settings.contact_directories.shared_contacts_note_user_id")
      : t("workspace.settings.contact_directories.shared_contacts_note_email");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <BookUserIcon aria-hidden="true" />
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {mode === "unarchive"
              ? t("workspace.settings.contact_directories.unarchive_directory_description")
              : t("workspace.settings.contact_directories.create_directory_description")}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form className="contents" onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogBody className="flex flex-col gap-5">
              <FormField
                control={control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.name")}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t("workspace.settings.contact_directories.name_placeholder")}
                        {...field}
                      />
                    </FormControl>
                    {error?.message ? <FormError className="text-left">{error.message}</FormError> : null}
                  </FormItem>
                )}
              />

              {directory ? (
                // Review point 7: fixed once the directory exists, so shown as text, not a disabled toggle.
                <p className="text-sm text-slate-700">
                  {directory.matchingKey === "userId"
                    ? t("workspace.settings.contact_directories.matches_contacts_by_user_id")
                    : t("workspace.settings.contact_directories.matches_contacts_by_email")}
                </p>
              ) : (
                <div className="space-y-2">
                  <Label id={`${MATCHING_KEY_TOGGLE_ID}-toggle-label`}>
                    {t("workspace.settings.contact_directories.match_contacts_by")}
                  </Label>
                  <Muted className="block text-slate-500">
                    {t("workspace.settings.contact_directories.matching_key_help")}
                  </Muted>
                  <TabToggle<TContactDirectoryMatchingKey>
                    id={MATCHING_KEY_TOGGLE_ID}
                    options={[
                      { value: "email", label: t("common.email") },
                      { value: "userId", label: t("common.user_id") },
                    ]}
                    value={matchingKey}
                    onChange={(value) => setValue("matchingKey", value, { shouldDirty: true })}
                  />
                </div>
              )}

              <FormField
                control={control}
                name="workspaceIds"
                render={({ fieldState: { error } }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>{t("common.workspaces")}</FormLabel>
                    <Muted className="block text-slate-500">
                      {t("workspace.settings.contact_directories.workspaces_help")}
                    </Muted>
                    <MultiSelect
                      options={workspaceOptions}
                      value={workspaceIds}
                      onChange={(selected) =>
                        setValue("workspaceIds", selected, { shouldDirty: true, shouldValidate: true })
                      }
                      placeholder={t("workspace.settings.contact_directories.select_workspaces_placeholder")}
                      containerClassName="focus-within:ring-0 focus-within:ring-offset-0"
                    />
                    {workspaceIds.length >= CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES ? (
                      <p className="text-xs text-slate-500">{sharedContactsNote}</p>
                    ) : null}
                    {error?.message ? <FormError className="text-left">{error.message}</FormError> : null}
                  </FormItem>
                )}
              />
              {directory ? (
                <IdBadge
                  id={directory.id}
                  label={t("workspace.settings.contact_directories.directory_id")}
                  variant="column"
                />
              ) : null}
            </DialogBody>
            <DialogFooter>
              {mode === "manage" ? (
                <div className="flex w-full flex-row">
                  {/* ADR 0062: only a directory with no workspaces can be archived. aria-disabled, not
                      disabled, so the tooltip still shows on hover and focus. */}
                  <TooltipRenderer
                    shouldRender={!canArchive}
                    tooltipContent={t("workspace.settings.contact_directories.archive_needs_no_workspaces")}
                    className="w-auto">
                    <Button
                      type="button"
                      variant="secondary"
                      aria-disabled={!canArchive || undefined}
                      disabled={isSaving}
                      onClick={archiveDirectory}>
                      {t("workspace.settings.contact_directories.archive_directory")}
                    </Button>
                  </TooltipRenderer>
                </div>
              ) : null}
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSaving && !pendingRemoval}>
                {getSubmitLabel()}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
      {directory && pendingRemoval && pendingEffect ? (
        <ContactDirectoryRemovalDialog
          directory={directory}
          removed={pendingEffect.removed}
          removesLastWorkspace={pendingEffect.removesLastWorkspace}
          isSaving={updateDirectory.isPending}
          onBack={() => setPendingRemoval(null)}
          onConfirm={(choice) => saveChanges(pendingRemoval, choice)}
        />
      ) : null}
    </Dialog>
  );
};
