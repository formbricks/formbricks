import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
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
  responses: TResponse[];
  selectedResponseId: string | null;
  setSelectedResponseId: (id: string | null) => void;
  survey: TSurvey;
  environment: TEnvironment;
  user?: TUser;
  environmentTags: TTag[];
  updateResponse: (responseId: string, updatedResponse: TResponse) => void;
  updateResponseList: (responseIds: string[]) => void;
  isReadOnly: boolean;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  locale: TUserLocale;
}

export const ResponseCardModal = ({
  responses,
  selectedResponseId,
  setSelectedResponseId,
  survey,
  environment,
  user,
  environmentTags,
  updateResponse,
  updateResponseList,
  isReadOnly,
  open,
  setOpen,
  locale,
}: ResponseCardModalProps) => {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const idToIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < responses.length; i++) {
      map.set(responses[i].id, i);
    }
    return map;
  }, [responses]);

  useEffect(() => {
    if (selectedResponseId) {
      setOpen(true);
      const index = idToIndexMap.get(selectedResponseId) ?? -1;
      setCurrentIndex(index);
      setIsNavigating(false);
    } else {
      setOpen(false);
    }
  }, [selectedResponseId, idToIndexMap, setOpen]);

  const handleNext = () => {
    if (currentIndex !== null && currentIndex < responses.length - 1) {
      setIsNavigating(true);
      setSelectedResponseId(responses[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentIndex !== null && currentIndex > 0) {
      setIsNavigating(true);
      setSelectedResponseId(responses[currentIndex - 1].id);
    }
  };

  const handleClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setSelectedResponseId(null);
    }
  };

  // If no response is selected or currentIndex is null or invalid, do not render the modal
  if (selectedResponseId === null || currentIndex === null || currentIndex === -1) return null;

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
          <SingleResponseCard
            survey={survey}
            response={responses[currentIndex]}
            user={user}
            environment={environment}
            environmentTags={environmentTags}
            isReadOnly={isReadOnly}
            updateResponse={updateResponse}
            updateResponseList={updateResponseList}
            setSelectedResponseId={setSelectedResponseId}
            locale={locale}
          />
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
