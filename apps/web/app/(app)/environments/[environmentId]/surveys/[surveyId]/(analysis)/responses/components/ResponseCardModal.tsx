import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";
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
}: ResponseCardModalProps) => {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedResponse) {
      const index = responses.findIndex((response) => response.id === selectedResponse.id);
      setCurrentIndex(index);
    }
  }, [selectedResponse, responses]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-md">
      <div className="h-full max-h-[80vh] w-full max-w-5xl overflow-hidden rounded-lg">
        <div className="relative h-full w-full overflow-auto bg-slate-50 p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-end space-x-2">
            <Button
              onClick={handleBack}
              disabled={currentIndex === 0}
              variant="minimal"
              className="border border-slate-100 bg-white p-2 text-gray-500 hover:text-gray-800">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentIndex === responses.length - 1}
              variant="minimal"
              className="border border-slate-100 bg-white p-2 text-gray-500 hover:text-gray-800">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button
              className="border border-slate-100 bg-white p-2 text-gray-500 hover:text-gray-800"
              onClick={handleClose}
              variant="minimal">
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
          />
        </div>
      </div>
    </div>
  );
};
