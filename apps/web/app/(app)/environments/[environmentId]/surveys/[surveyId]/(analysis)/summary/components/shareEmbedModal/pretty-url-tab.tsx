"use client";

import { Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/survey-context";
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
import { PrettyUrlInput } from "./pretty-url-input";

interface PrettyUrlTabProps {
  publicDomain: string;
  isReadOnly?: boolean;
}

interface PrettyUrlFormData {
  slug: string;
}

export const PrettyUrlTab = ({ publicDomain, isReadOnly = false }: PrettyUrlTabProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { survey } = useSurvey();
  const [isEditing, setIsEditing] = useState(!survey.slug);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with current values - memoize to prevent re-initialization
  const initialFormData = useMemo(() => {
    return {
      slug: survey.slug || "",
    };
  }, [survey.slug]);

  const form = useForm<PrettyUrlFormData>({
    defaultValues: initialFormData,
  });

  const { handleSubmit, reset } = form;

  // Sync isEditing state and form with survey.slug changes
  useEffect(() => {
    setIsEditing(!survey.slug);
    reset({ slug: survey.slug || "" });
  }, [survey.slug, reset]);

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

      const errorMessage = getFormattedErrorMessage(result);
      if (errorMessage) {
        toast.error(errorMessage);
      } else {
        toast.success(t("environments.surveys.share.pretty_url.save_success"));
        router.refresh();
        setIsEditing(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.something_went_wrong_please_try_again");
      toast.error(message);
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

      const errorMessage = getFormattedErrorMessage(result);
      if (errorMessage) {
        toast.error(errorMessage);
      } else {
        setShowRemoveDialog(false);
        reset({ slug: "" });
        router.refresh();
        setIsEditing(true);
        toast.success(t("environments.surveys.share.pretty_url.remove_success"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.something_went_wrong_please_try_again");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyUrl = () => {
    if (!survey.slug) return;
    const prettyUrl = `${publicDomain}/p/${survey.slug}`;
    navigator.clipboard.writeText(prettyUrl);
    toast.success(t("common.copied_to_clipboard"));
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
              <>
                <Button type="button" variant="default" onClick={handleCopyUrl} disabled={isReadOnly}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t("common.copy")} URL
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowRemoveDialog(true)}
                  disabled={isReadOnly}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.remove")}
                </Button>
              </>
            )}
          </div>
        </form>
      </FormProvider>

      <DeleteDialog
        open={showRemoveDialog}
        setOpen={setShowRemoveDialog}
        deleteWhat={t("environments.surveys.share.pretty_url.title")}
        onDelete={handleRemove}
        text={t("environments.surveys.share.pretty_url.remove_description")}></DeleteDialog>
    </div>
  );
};
