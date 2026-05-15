"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useEffect, useRef, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUserLocale } from "@formbricks/types/user";
import {
  getResponseAction,
  getTagsByEnvironmentIdAction,
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
  environment: TEnvironment;
  isReadOnly: boolean;
  locale: TUserLocale;
}

export const ResponseSampleModal = ({
  responseId,
  onClose,
  survey,
  environment,
  isReadOnly,
  locale,
}: ResponseSampleModalProps) => {
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
      getTagsByEnvironmentIdAction({ environmentId: environment.id }),
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
  }, [responseId, environment.id]);

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={!!responseId} onOpenChange={handleOpenChange}>
      <DialogContent width="wide">
        <VisuallyHidden asChild>
          <DialogTitle>Survey Response Details</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden asChild>
          <DialogDescription>Full response details</DialogDescription>
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
              environment={environment}
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
