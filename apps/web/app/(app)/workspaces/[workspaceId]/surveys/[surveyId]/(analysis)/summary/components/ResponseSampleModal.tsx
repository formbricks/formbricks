"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUserLocale } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import {
  getResponseAction,
  getTagsByWorkspaceIdAction,
} from "@/modules/analysis/components/SingleResponseCard/actions";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

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
  const [response, setResponse] = useState<TResponseWithQuotas | null>(null);
  const [tags, setTags] = useState<TTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cache fetched data per response ID to avoid re-fetching on re-open
  const cache = useRef<Map<string, { response: TResponseWithQuotas; tags: TTag[] }>>(new Map());
  // Track the in-flight request so stale resolutions can be ignored when the user
  // switches rows quickly.
  const latestRequestId = useRef<string | null>(null);

  useEffect(() => {
    if (!responseId) return;

    const cached = cache.current.get(responseId);
    if (cached) {
      setResponse(cached.response);
      setTags(cached.tags);
      setErrorMessage(null);
      return;
    }

    latestRequestId.current = responseId;
    setIsLoading(true);
    setResponse(null);
    setErrorMessage(null);

    Promise.all([
      getResponseAction({ responseId }),
      getTagsByWorkspaceIdAction({ workspaceId: survey.workspaceId }),
    ])
      .then(([responseResult, tagsResult]) => {
        // Discard if a newer request has started or the modal has been closed.
        if (latestRequestId.current !== responseId) return;

        const responseError = getFormattedErrorMessage(responseResult);
        const tagsError = getFormattedErrorMessage(tagsResult);
        const fetchedResponse = responseResult?.data ?? null;
        const fetchedTags = tagsResult?.data ?? [];

        if (responseError || tagsError || !fetchedResponse) {
          const message = responseError || tagsError || t("common.something_went_wrong");
          toast.error(message);
          setErrorMessage(message);
          return;
        }

        const entry = { response: fetchedResponse, tags: fetchedTags };
        cache.current.set(responseId, entry);
        setResponse(entry.response);
        setTags(entry.tags);
      })
      .catch(() => {
        if (latestRequestId.current !== responseId) return;
        const message = t("common.something_went_wrong");
        toast.error(message);
        setErrorMessage(message);
      })
      .finally(() => {
        if (latestRequestId.current !== responseId) return;
        setIsLoading(false);
      });
  }, [responseId, survey.workspaceId, t]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Drop any in-flight request so it can't commit after close.
      latestRequestId.current = null;
      setErrorMessage(null);
      onClose();
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="py-12">
          <LoadingSpinner />
        </div>
      );
    }

    if (errorMessage) {
      return <div className="py-12 text-center text-sm text-slate-600">{errorMessage}</div>;
    }

    if (response) {
      return (
        <SingleResponseCard
          survey={survey}
          response={response}
          environmentTags={tags}
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
