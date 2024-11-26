import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";
import { Modal } from "@formbricks/ui/Modal";
import { SingleResponseCard } from "@formbricks/ui/SingleResponseCard";

interface ResponseCardModalProps {
  responses: TResponse[];
  selectedResponse: TResponse | null;
  setSelectedResponse: (response: TResponse | null) => void;
  survey: TSurvey;
  environment: TEnvironment;
  user?: TUser;
  environmentTags: TTag[];
  updateResponse: (responseId: string, updatedResponse: TResponse) => void;
  deleteResponses: (responseIds: string[]) => void;
  isViewer: boolean;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ResponseCardModal = ({
  responses,
  selectedResponse,
  setSelectedResponse,
  survey,
  environment,
  user,
  environmentTags,
  updateResponse,
  deleteResponses,
  isViewer,
  open,
  setOpen,
}: ResponseCardModalProps) => {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedResponse) {
      setOpen(true);
      const index = responses.findIndex((response) => response.id === selectedResponse.id);
      setCurrentIndex(index);
    } else {
      setOpen(false);
    }
  }, [selectedResponse, responses, setOpen]);

  const handleNext = () => {
    if (currentIndex !== null && currentIndex < responses.length - 1) {
      setSelectedResponse(responses[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentIndex !== null && currentIndex > 0) {
      setSelectedResponse(responses[currentIndex - 1]);
    }
  };

  const handleClose = () => {
    setSelectedResponse(null);
  };

  // If no response is selected or currentIndex is null, do not render the modal
  if (selectedResponse === null || currentIndex === null) return null;

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
              variant="minimal"
              className="border bg-white p-2">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentIndex === responses.length - 1}
              variant="minimal"
              className="border bg-white p-2">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button className="border bg-white p-2" onClick={handleClose} variant="minimal">
              <XIcon className="h-5 w-5" />
            </Button>
          </div>
          <SingleResponseCard
            survey={survey}
            response={selectedResponse}
            user={user}
            pageType="response"
            environment={environment}
            environmentTags={environmentTags}
            isViewer={isViewer}
            updateResponse={updateResponse}
            deleteResponses={deleteResponses}
            setSelectedResponse={setSelectedResponse}
          />
        </div>
      </div>
    </Modal>
  );
};
