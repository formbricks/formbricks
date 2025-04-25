import { SingleResponseCard } from "@/modules/discover/components/common/survey-response-card";
import { Modal } from "@/modules/ui/components/modal";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SurveyInfoModalProps {
  response?: TResponse | null;
  survey: TSurvey;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SurveyInfoModal = ({ survey, response, open, setOpen }: SurveyInfoModalProps) => {
  if (!response) return;

  return (
    <Modal
      hideCloseButton
      open={open}
      setOpen={setOpen}
      size="md"
      className="max-h-[80vh] overflow-auto"
      noPadding
      closeOnOutsideClick={true}>
      <div className="h-full rounded-lg">
        <div className="relative h-full w-full overflow-auto p-4">
          <SingleResponseCard survey={survey} response={response} />
        </div>
      </div>
    </Modal>
  );
};
