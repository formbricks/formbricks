"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
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
import { Muted } from "@/modules/ui/components/typography";
import {
  useCreateMemberAttributeKey,
  useDeleteMemberAttributeKey,
  useUpdateMemberAttributeKey,
} from "../hooks/use-member-attributes";
import type { TMemberAttributeKeyItem } from "../lib/api-client";
import { type TAttributeKeyFormData, getAttributeKeyFormSchema } from "../lib/validate-attribute-key";
import { suggestMemberAttributeKey } from "../lib/values";

type TAttributeKeyDialogProps = Readonly<{
  organizationId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The key being edited; absent to create one. */
  attributeKey?: TMemberAttributeKeyItem;
}>;

/** The Feedback Datasets a 409 `member_attribute_key_in_use` names, for the delete refusal. */
const getDatasetsInUse = (error: unknown): string[] | null => {
  if (!(error instanceof V3ApiError) || error.code !== "member_attribute_key_in_use") return null;
  const datasets = (error.details as { datasets?: { name?: unknown }[] } | undefined)?.datasets ?? [];
  return datasets.map((dataset) => String(dataset.name ?? ""));
};

/**
 * Create attribute and Edit attribute (ENG-7474). The key fills itself from the label until edited, and
 * is locked once the attribute exists. Edit adds Delete attribute, refused while Dashboard Viewer access
 * of a Feedback Dataset uses the key (the 409 names the datasets).
 */
export const AttributeKeyDialog = ({
  organizationId,
  open,
  setOpen,
  attributeKey,
}: TAttributeKeyDialogProps) => {
  const { t } = useTranslation();
  const isEditing = Boolean(attributeKey);
  const [keyEdited, setKeyEdited] = useState(isEditing);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [datasetsInUse, setDatasetsInUse] = useState<string[] | null>(null);
  const createMutation = useCreateMemberAttributeKey(organizationId);
  const updateMutation = useUpdateMemberAttributeKey(organizationId);
  const deleteMutation = useDeleteMemberAttributeKey(organizationId);

  const form = useForm<TAttributeKeyFormData>({
    resolver: zodResolver(getAttributeKeyFormSchema(t, { isEditing })),
    mode: "onChange",
    defaultValues: {
      label: attributeKey?.label ?? "",
      key: attributeKey?.key ?? "",
      description: attributeKey?.description ?? "",
    },
  });

  const close = () => {
    setOpen(false);
    form.reset();
  };

  const onSubmit = form.handleSubmit((data) => {
    const description = data.description.trim() === "" ? null : data.description.trim();
    if (attributeKey) {
      updateMutation.mutate(
        { keyId: attributeKey.id, label: data.label, description, expectedUpdatedAt: attributeKey.updatedAt },
        {
          onSuccess: () => {
            toast.success(t("workspace.settings.member_attributes.attribute_updated"));
            close();
          },
          onError: (error) =>
            toast.error(
              error instanceof V3ApiError && error.status === 409
                ? t("workspace.settings.member_attributes.changed_elsewhere")
                : getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))
            ),
        }
      );
      return;
    }
    createMutation.mutate(
      { key: data.key, label: data.label, description },
      {
        onSuccess: () => {
          toast.success(t("workspace.settings.member_attributes.attribute_created"));
          close();
        },
        onError: (error) => {
          if (error instanceof V3ApiError && error.status === 409) {
            form.setError("key", { message: t("workspace.settings.member_attributes.key_taken") });
            return;
          }
          toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
        },
      }
    );
  });

  const onDelete = () => {
    if (!attributeKey) return;
    deleteMutation.mutate(
      { keyId: attributeKey.id, expectedUpdatedAt: attributeKey.updatedAt },
      {
        onSuccess: () => {
          toast.success(t("workspace.settings.member_attributes.attribute_deleted"));
          setIsDeleteOpen(false);
          close();
        },
        onError: (error) => {
          const datasets = getDatasetsInUse(error);
          if (datasets) {
            setDatasetsInUse(datasets);
            return;
          }
          toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
        },
      }
    );
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent>
        <DialogHeader className="pb-4">
          <DialogTitle>
            {isEditing
              ? t("workspace.settings.member_attributes.edit_attribute")
              : t("workspace.settings.member_attributes.create_attribute")}
          </DialogTitle>
          <DialogDescription>
            {t("workspace.settings.member_attributes.dialog_description")}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form className="contents" onSubmit={(event) => void onSubmit(event)}>
            <DialogBody className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.label")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("workspace.settings.member_attributes.label_placeholder")}
                        onChange={(event) => {
                          field.onChange(event);
                          if (!keyEdited) {
                            form.setValue("key", suggestMemberAttributeKey(event.target.value), {
                              shouldValidate: true,
                            });
                          }
                        }}
                      />
                    </FormControl>
                    <Muted className="text-slate-500">
                      {t("workspace.settings.member_attributes.label_help")}
                    </Muted>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="key"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.key")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isEditing}
                        className="font-mono"
                        placeholder="country"
                        onChange={(event) => {
                          setKeyEdited(true);
                          field.onChange(event);
                        }}
                      />
                    </FormControl>
                    <Muted className="text-slate-500">
                      {isEditing
                        ? t("workspace.settings.member_attributes.key_locked_help")
                        : t("workspace.settings.member_attributes.key_help")}
                    </Muted>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>
                      {t("common.description")}{" "}
                      <span className="font-normal text-slate-500">({t("common.optional")})</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />
            </DialogBody>
            <DialogFooter>
              {isEditing && (
                <div className="w-full">
                  <Button type="button" variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                    {t("workspace.settings.member_attributes.delete_attribute")}
                  </Button>
                </div>
              )}
              <Button type="button" variant="outline" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSaving}>
                {isEditing ? t("common.save") : t("workspace.settings.member_attributes.create_attribute")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
      {attributeKey && (
        <DeleteDialog
          open={isDeleteOpen}
          setOpen={(next) => {
            setIsDeleteOpen(next);
            if (!next) setDatasetsInUse(null);
          }}
          deleteWhat={attributeKey.label}
          onDelete={onDelete}
          isDeleting={deleteMutation.isPending}
          disabled={datasetsInUse !== null}
          text={
            datasetsInUse
              ? t("workspace.settings.member_attributes.delete_refused_in_use", {
                  datasets: datasetsInUse.join(", "),
                })
              : t("workspace.settings.member_attributes.delete_attribute_confirmation", {
                  count: attributeKey.memberCount,
                })
          }
        />
      )}
    </Dialog>
  );
};
