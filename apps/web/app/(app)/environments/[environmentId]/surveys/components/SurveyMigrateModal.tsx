import { SendToBack } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Modal } from "@formbricks/ui/components/Modal";
import SurveyMigrateOptions from "./SurveyMigrateOptions";

interface MigrateSurveyModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  survey: TSurvey;
  onMigrated: (surveyId: string) => void;
}

export const SurveyMigrateModal = ({ open, setOpen, survey, onMigrated }: MigrateSurveyModalProps) => (
  <Modal open={open} setOpen={setOpen} noPadding restrictOverflow>
    <div className="flex h-full flex-col rounded-lg">
      <div className="fixed left-0 right-0 z-10 h-24 rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center justify-between p-6">
          <div className="flex items-center space-x-2">
            <SendToBack className="h-6 w-6 text-slate-500" />
            <div>
              <div className="text-xl font-medium text-slate-700">Migrate Survey</div>
              <div className="text-sm text-slate-500">
                Move this survey to a different product while keeping all responses attached
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-full max-h-[500px] overflow-auto pl-4 pt-24">
        <SurveyMigrateOptions
          survey={survey}
          onCancel={() => setOpen(false)}
          setOpen={setOpen}
          onMigrated={onMigrated}
        />
      </div>
    </div>
  </Modal>
);
