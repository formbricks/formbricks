"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BookUserIcon } from "lucide-react";
import { useMemo } from "react";
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
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { Muted } from "@/modules/ui/components/typography";
import { useCreateContactDirectory, useUpdateContactDirectory } from "../hooks/use-contact-directories";
import { CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES } from "../lib/constants";
import {
  type TContactDirectoryFormData,
  getContactDirectoryErrorMessage,
  getContactDirectoryFormSchema,
} from "../lib/directory-form";
import { getContactDirectoryDisplayName, getWorkspacePickerOptions } from "../lib/display";
import type { TContactDirectory, TContactDirectoryList, TContactDirectoryMatchingKey } from "../types";

const MATCHING_KEY_TOGGLE_ID = "contact-directory-matching-key";

interface ContactDirectoryDialogProps {
  organizationId: string;
  list: TContactDirectoryList;
  /** The directory to manage; omitted to create one. */
  directory?: TContactDirectory;
  onClose: () => void;
}

/**
 * Create and Manage share one dialog (spec decision 20): name, matching key (fixed once created) and
 * workspaces. Mount it only while open, so each opening starts from the directory as the list has it.
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

  const initialWorkspaceIds = useMemo(
    () => directory?.workspaces.map(({ id }) => id) ?? [],
    [directory?.workspaces]
  );

  const form = useForm<TContactDirectoryFormData>({
    resolver: zodResolver(getContactDirectoryFormSchema(t, initialWorkspaceIds)),
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

  // An unnamed directory (one the migration made) shows its workspace's name as the placeholder (decision 2).
  const namePlaceholder =
    directory?.name === null
      ? getContactDirectoryDisplayName(directory)
      : t("workspace.settings.contact_directories.name_placeholder");

  const isSaving = createDirectory.isPending || updateDirectory.isPending;

  const handleSaved = () => {
    toast.success(
      directory
        ? t("workspace.settings.contact_directories.directory_updated")
        : t("workspace.settings.contact_directories.directory_created")
    );
    onClose();
  };

  const handleSaveError = (error: unknown) => {
    const message = getContactDirectoryErrorMessage(error, t);
    // A taken name belongs to the field; anything else is about the whole save.
    if (error instanceof V3ApiError && error.code === "contact_directory_name_taken") {
      setError("name", { message });
      return;
    }
    toast.error(message);
  };

  const onSubmit: SubmitHandler<TContactDirectoryFormData> = (data) => {
    const name = data.name.trim() === "" ? null : data.name.trim();
    const callbacks = { onSuccess: handleSaved, onError: handleSaveError };
    if (directory) {
      updateDirectory.mutate(
        { directoryId: directory.id, input: { name, workspaceIds: data.workspaceIds } },
        callbacks
      );
    } else {
      createDirectory.mutate(
        { name, matchingKey: data.matchingKey, workspaceIds: data.workspaceIds },
        callbacks
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <BookUserIcon aria-hidden="true" />
          <DialogTitle>
            {directory
              ? t("workspace.settings.contact_directories.manage_directory")
              : t("workspace.settings.contact_directories.create_directory")}
          </DialogTitle>
          <DialogDescription>
            {t("workspace.settings.contact_directories.create_directory_description")}
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
                      <Input type="text" placeholder={namePlaceholder} {...field} />
                    </FormControl>
                    {error?.message ? <FormError className="text-left">{error.message}</FormError> : null}
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label id={`${MATCHING_KEY_TOGGLE_ID}-toggle-label`}>
                  {t("workspace.settings.contact_directories.match_contacts_by")}
                </Label>
                <TabToggle<TContactDirectoryMatchingKey>
                  id={MATCHING_KEY_TOGGLE_ID}
                  options={[
                    { value: "email", label: t("common.email") },
                    { value: "externalId", label: t("workspace.settings.contact_directories.external_id") },
                  ]}
                  value={matchingKey}
                  onChange={(value) => setValue("matchingKey", value, { shouldDirty: true })}
                  // Fixed once the directory exists (spec decision 1).
                  disabled={Boolean(directory)}
                />
                <p className="text-xs text-slate-500">
                  {t("workspace.settings.contact_directories.matching_key_help")}
                </p>
              </div>

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
                      <p className="text-xs text-slate-500">
                        {t("workspace.settings.contact_directories.shared_contacts_note")}
                      </p>
                    ) : null}
                    {error?.message ? <FormError className="text-left">{error.message}</FormError> : null}
                  </FormItem>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSaving}>
                {directory ? t("common.save") : t("workspace.settings.contact_directories.create_directory")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
