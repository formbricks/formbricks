import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";

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
    <Modal
      hideCloseButton
      open={open}
      setOpen={setOpen}
      size="xxl"
      className="max-h-[80vh] overflow-auto"
      noPadding>
      <div className="h-full rounded-lg">
        <div className="relative h-full w-full overflow-auto p-4">
          <div className="mb-4 flex items-center justify-end space-x-2">
            <Button
              onClick={handleBack}
              disabled={currentIndex === 0}
              variant="ghost"
              className="border bg-white p-2">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentIndex === responses.length - 1}
              variant="ghost"
              className="border bg-white p-2">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button className="border bg-white p-2" onClick={handleClose} variant="ghost">
              <XIcon className="h-5 w-5" />
            </Button>
          </div>
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
          />
        </div>
      </div>
    </Modal>
  );
};
