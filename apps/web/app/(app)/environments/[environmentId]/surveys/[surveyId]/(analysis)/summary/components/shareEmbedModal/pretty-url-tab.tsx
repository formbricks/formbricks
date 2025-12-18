"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { removeSurveySlugAction, updateSurveySlugAction } from "@/modules/survey/slug/actions";
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

interface PrettyUrlTabProps {
  survey: TSurvey;
  publicDomain: string;
  isReadOnly?: boolean;
}

interface PrettyUrlFormData {
  slug: string;
}

export const PrettyUrlTab = ({ survey, publicDomain, isReadOnly = false }: PrettyUrlTabProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(!survey.slug);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PrettyUrlFormData>({
    defaultValues: {
      slug: survey.slug || "",
    },
  });

  const { handleSubmit, reset } = form;

  const onSubmit = async (data: PrettyUrlFormData) => {
    if (!data.slug.trim()) {
      toast.error(t("environments.surveys.share.pretty_url.slug_required"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateSurveySlugAction({
        surveyId: survey.id,
        slug: data.slug,
      });

      if (result?.data) {
        if (result.data.ok) {
          toast.success(t("environments.surveys.share.pretty_url.save_success"));
          setIsEditing(false);
        } else {
          toast.error(result.data.error.message);
        }
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage || "Failed to update slug");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update slug");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    reset({ slug: survey.slug || "" });
    setIsEditing(false);
  };

  const handleRemove = async () => {
    setIsSubmitting(true);
    try {
      const result = await removeSurveySlugAction({ surveyId: survey.id });

      if (result?.data) {
        if (result.data.ok) {
          setShowRemoveDialog(false);
          reset({ slug: "" });
          setIsEditing(true);
          toast.success(t("environments.surveys.share.pretty_url.remove_success"));
        } else {
          toast.error(result.data.error.message);
        }
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage || "Failed to remove slug");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove slug");
    } finally {
      setIsSubmitting(false);
    }
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
                <Button type="submit" disabled={isReadOnly || isSubmitting}>
                  {t("common.save")}
                </Button>
                {survey.slug && (
                  <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
                    {t("common.cancel")}
                  </Button>
                )}
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={handleEdit} disabled={isReadOnly}>
                {t("common.edit")}
              </Button>
            )}

            {survey.slug && !isEditing && (
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
          <p className="font-mono text-sm text-slate-700">{`${publicDomain}/p/${survey.slug || ""}`}</p>
        </div>
      </DeleteDialog>
    </div>
  );
};
