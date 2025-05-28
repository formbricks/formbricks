import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import { Button } from "@/modules/ui/components/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/modules/ui/components/dialog";
import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";

interface ResponseCardModalProps {
  responses: TResponse[];
  selectedResponseId: string | null;
  setSelectedResponseId: (id: string | null) => void;
  survey: TSurvey;
  environment: TEnvironment;
  user?: TUser;
  environmentTags: TTag[];
  updateResponse: (responseId: string, updatedResponse: TResponse) => void;
  deleteResponses: (responseIds: string[]) => void;
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
  deleteResponses,
  isReadOnly,
  open,
  setOpen,
  locale,
}: ResponseCardModalProps) => {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedResponseId) {
      setOpen(true);
      const index = responses.findIndex((response) => response.id === selectedResponseId);
      setCurrentIndex(index);
    } else {
      setOpen(false);
    }
  }, [selectedResponseId, responses, setOpen]);

  const handleNext = () => {
    if (currentIndex !== null && currentIndex < responses.length - 1) {
      setSelectedResponseId(responses[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentIndex !== null && currentIndex > 0) {
      setSelectedResponseId(responses[currentIndex - 1].id);
    }
  };

  const handleClose = () => {
    setSelectedResponseId(null);
  };

  // If no response is selected or currentIndex is null, do not render the modal
  if (selectedResponseId === null || currentIndex === null) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent width="wide">
        <DialogBody>
          <SingleResponseCard
            survey={survey}
            response={responses[currentIndex]}
            user={user}
            pageType="response"
            environment={environment}
            environmentTags={environmentTags}
            isReadOnly={isReadOnly}
            updateResponse={updateResponse}
            deleteResponses={deleteResponses}
            setSelectedResponseId={setSelectedResponseId}
            locale={locale}
          />
        </DialogBody>
        <DialogFooter>
          <Button onClick={handleBack} disabled={currentIndex === 0} variant="outline" size="icon">
            <ChevronLeft />
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentIndex === responses.length - 1}
            variant="outline"
            size="icon">
            <ChevronRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
