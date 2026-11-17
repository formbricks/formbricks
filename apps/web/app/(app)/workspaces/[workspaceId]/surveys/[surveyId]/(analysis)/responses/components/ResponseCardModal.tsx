import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import {
  isNavigationInFlight,
  navigatingFromIdAfterSelect,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/responses/lib/response-navigation";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import type { TOutcomeActions } from "@/modules/analysis/response-outcome/lib/outcome";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface ResponseCardModalProps {
  readonly responses: TResponse[];
  readonly selectedResponseId: string | null;
  readonly setSelectedResponseId: (id: string | null) => void;
  readonly survey: TSurvey;
  readonly user?: TUser;
  readonly environmentTags: TTag[];
  readonly updateResponse: (responseId: string, updatedResponse: TResponse) => void;
  readonly updateResponseList: (responseIds: string[]) => void;
  readonly isReadOnly: boolean;
  readonly open: boolean;
  readonly setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  readonly locale: TUserLocale;
  readonly outcomeActions?: TOutcomeActions;
}

export const ResponseCardModal = ({
  responses,
  selectedResponseId,
  setSelectedResponseId,
  survey,
  user,
  environmentTags,
  updateResponse,
  updateResponseList,
  isReadOnly,
  open,
  setOpen,
  locale,
  outcomeActions,
}: ResponseCardModalProps) => {
  // The response a Next/Back click left from. Navigation is in flight until the selection moves off it.
  const [navigatingFromId, setNavigatingFromId] = useState<string | null>(null);

  const idToIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < responses.length; i++) {
      map.set(responses[i].id, i);
    }
    return map;
  }, [responses]);

  const currentIndex = selectedResponseId === null ? null : (idToIndexMap.get(selectedResponseId) ?? -1);
  const isNavigating = isNavigationInFlight(navigatingFromId, selectedResponseId);

  // Every selection change goes through here, including the card's own (it clears the selection after
  // deleting the open response), so clearing it always ends navigation.
  const selectResponse = (id: string | null) => {
    setNavigatingFromId((current) => navigatingFromIdAfterSelect(current, id));
    setSelectedResponseId(id);
  };

  const handleNext = () => {
    if (currentIndex !== null && currentIndex < responses.length - 1) {
      setNavigatingFromId(selectedResponseId);
      setSelectedResponseId(responses[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentIndex !== null && currentIndex > 0) {
      setNavigatingFromId(selectedResponseId);
      setSelectedResponseId(responses[currentIndex - 1].id);
    }
  };

  const handleClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      selectResponse(null);
    }
  };

  // If no response is selected or the selected one is no longer in `responses` (it was just deleted),
  // do not render the modal. `responses[currentIndex]` would be `undefined` and `SingleResponseCard`
  // throws reading `response.finished`, replacing the page with the error screen instead of the empty
  // state (ENG-2130).
  if (
    selectedResponseId === null ||
    currentIndex === null ||
    currentIndex < 0 ||
    currentIndex >= responses.length
  )
    return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent width="wide">
        <VisuallyHidden asChild>
          <DialogTitle>Survey Response Details</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden asChild>
          <DialogDescription>
            Response {currentIndex + 1} of {responses.length}
          </DialogDescription>
        </VisuallyHidden>
        <DialogBody>
          <div className="my-3">
            <SingleResponseCard
              survey={survey}
              response={responses[currentIndex]}
              user={user}
              environmentTags={environmentTags}
              isReadOnly={isReadOnly}
              updateResponse={updateResponse}
              updateResponseList={updateResponseList}
              setSelectedResponseId={selectResponse}
              locale={locale}
              outcomeActions={outcomeActions}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={handleBack}
            disabled={currentIndex === 0 || isNavigating}
            variant="outline"
            size="icon">
            <ChevronLeft />
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentIndex === responses.length - 1 || isNavigating}
            variant="outline"
            size="icon">
            <ChevronRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
