"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUserLocale } from "@formbricks/types/user";
import {
  getResponseAction,
  getTagsByWorkspaceIdAction,
} from "@/modules/analysis/components/SingleResponseCard/actions";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
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

  // Cache fetched data per response ID to avoid re-fetching on re-open
  const cache = useRef<Map<string, { response: TResponseWithQuotas; tags: TTag[] }>>(new Map());

  useEffect(() => {
    if (!responseId) return;

    const cached = cache.current.get(responseId);
    if (cached) {
      setResponse(cached.response);
      setTags(cached.tags);
      return;
    }

    setIsLoading(true);
    setResponse(null);

    Promise.all([
      getResponseAction({ responseId }),
      getTagsByWorkspaceIdAction({ workspaceId: survey.workspaceId }),
    ])
      .then(([responseResult, tagsResult]) => {
        const fetchedResponse = responseResult?.data ?? null;
        const fetchedTags = tagsResult?.data ?? [];

        if (fetchedResponse) {
          const entry = { response: fetchedResponse as TResponseWithQuotas, tags: fetchedTags };
          cache.current.set(responseId, entry);
          setResponse(entry.response);
          setTags(entry.tags);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [responseId, survey.workspaceId]);

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
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
        <DialogBody>
          {isLoading || !response ? (
            <div className="py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <SingleResponseCard
              survey={survey}
              response={response}
              environmentTags={tags}
              isReadOnly={isReadOnly}
              locale={locale}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
