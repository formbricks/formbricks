"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { PrettyUrlInput } from "./components/pretty-url-input";

// TODO: Remove this extension once prettyUrl is added to the Survey model and TSurvey type
type TSurveyWithPrettyUrl = TSurvey & {
  prettyUrl?: string | null;
};

interface PrettyUrlTabProps {
  survey: TSurveyWithPrettyUrl;
  publicDomain: string;
  isReadOnly?: boolean;
}

interface PrettyUrlFormData {
  slug: string;
}

export const PrettyUrlTab = ({ survey, publicDomain, isReadOnly = false }: PrettyUrlTabProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(!survey.prettyUrl);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const form = useForm<PrettyUrlFormData>({
    defaultValues: {
      slug: survey.prettyUrl || "",
    },
  });

  const { handleSubmit, reset } = form;

  const onSubmit = (data: PrettyUrlFormData) => {
    if (!data.slug.trim()) {
      toast.error(t("environments.surveys.share.pretty_url.slug_required"));
      return;
    }
    // TODO: Implement actual save logic with backend
    toast.success(t("environments.surveys.share.pretty_url.save_success"));
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    reset({ slug: survey.prettyUrl || "" });
    setIsEditing(false);
  };

  const handleRemove = () => {
    // TODO: Implement actual remove logic with backend
    setShowRemoveDialog(false);
    reset({ slug: "" });
    setIsEditing(true);
    toast.success(t("environments.surveys.share.pretty_url.remove_success"));
  };

  return (
    <div className="px-1">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("environments.surveys.share.pretty_url.slug_label")}</FormLabel>
                <FormControl>
                  <PrettyUrlInput
                    value={field.value}
                    onChange={field.onChange}
                    publicDomain={publicDomain}
                    disabled={isReadOnly || !isEditing}
                  />
                </FormControl>
                <FormDescription>{t("environments.surveys.share.pretty_url.slug_help")}</FormDescription>
              </FormItem>
            )}
          />

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button type="submit" disabled={isReadOnly}>
                  {t("common.save")}
                </Button>
                {survey.prettyUrl && (
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    {t("common.cancel")}
                  </Button>
                )}
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={handleEdit} disabled={isReadOnly}>
                {t("common.edit")}
              </Button>
            )}

            {survey.prettyUrl && !isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowRemoveDialog(true)}
                disabled={isReadOnly}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("common.remove")}
              </Button>
            )}
          </div>
        </form>
      </FormProvider>

      <DeleteDialog
        open={showRemoveDialog}
        setOpen={setShowRemoveDialog}
        deleteWhat={t("environments.surveys.share.pretty_url.title")}
        onDelete={handleRemove}
        text={t("environments.surveys.share.pretty_url.remove_description")}>
        <div className="rounded bg-slate-100 p-3">
          <p className="font-mono text-sm text-slate-700">{`${publicDomain}/p/${survey.prettyUrl || ""}`}</p>
        </div>
      </DeleteDialog>
    </div>
  );
};
