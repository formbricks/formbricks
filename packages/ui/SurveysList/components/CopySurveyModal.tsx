import { MousePointerClickIcon } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Modal } from "../../Modal";
import SurveyCopyOptions from "./SurveyCopyOptions";

interface CopySurveyModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  survey: TSurvey;
}

export const CopySurveyModal = ({ open, setOpen, survey }: CopySurveyModalProps) => (
  <Modal open={open} setOpen={setOpen} noPadding restrictOverflow>
    <div className="flex h-full flex-col rounded-lg">
      <div className="fixed left-0 right-0 z-10 h-24 rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center justify-between p-6">
          <div className="flex items-center space-x-2">
            <MousePointerClickIcon className="h-6 w-6 text-slate-500" />
            <div>
              <div className="text-xl font-medium text-slate-700">Copy Survey</div>
              <div className="text-sm text-slate-500">Copy this survey to another environment</div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-full max-h-[500px] overflow-auto pl-4 pt-24">
        <SurveyCopyOptions
          survey={survey}
          environmentId={survey.environmentId}
          onCancel={() => setOpen(false)}
          setOpen={setOpen}
        />
      </div>
    </div>
  </Modal>
);
