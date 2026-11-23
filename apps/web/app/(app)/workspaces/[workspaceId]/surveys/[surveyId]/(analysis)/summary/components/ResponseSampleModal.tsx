"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import { useResponseCard } from "@/modules/analysis/components/SingleResponseCard/hooks/use-response-card";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { useTags } from "@/modules/workspaces/settings/tags/hooks/use-tags";

interface ResponseSampleModalProps {
  responseId: string | null;
  onClose: () => void;
  survey: TSurvey;
  isReadOnly: boolean;
  locale: TUserLocale;
}

export const ResponseSampleModal = ({
  responseId,
  onClose,
  survey,
  isReadOnly,
  locale,
}: Readonly<ResponseSampleModalProps>) => {
  const { t } = useTranslation();
  // Both reads wait for a picked response, and stay in the query cache, so re-opening a response the
  // modal already showed renders at once.
  const responseQuery = useResponseCard(responseId);
  const tagsQuery = useTags(survey.workspaceId, { enabled: responseId !== null });

  const error = responseQuery.error ?? tagsQuery.error;
  const errorMessage = error ? getV3ApiErrorMessage(error, t("common.something_went_wrong")) : null;

  useEffect(() => {
    if (error) toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong")));
  }, [error, t]);

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const renderBody = () => {
    if (responseQuery.isLoading || tagsQuery.isLoading) {
      return (
        <div className="py-12">
          <LoadingSpinner />
        </div>
      );
    }

    if (errorMessage) {
      return <div className="py-12 text-center text-sm text-slate-600">{errorMessage}</div>;
    }

    if (responseQuery.data) {
      return (
        <SingleResponseCard
          survey={survey}
          response={responseQuery.data}
          environmentTags={tagsQuery.data ?? []}
          isReadOnly={isReadOnly}
          locale={locale}
        />
      );
    }

    return null;
  };

  return (
    <Dialog open={!!responseId} onOpenChange={handleOpenChange}>
      <DialogContent width="wide">
        <VisuallyHidden asChild>
          <DialogTitle>{t("common.response")}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden asChild>
          <DialogDescription>{t("common.response")}</DialogDescription>
        </VisuallyHidden>
        <DialogBody>{renderBody()}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};
