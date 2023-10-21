import FileInput from "@formbricks/ui/FileInput";
import { Label } from "@formbricks/ui/Label";
import { TSurvey, TSurveyPictureSelectionQuestion } from "@formbricks/types/surveys";
import { Switch } from "@formbricks/ui/Switch";
import QuestionFormInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionFormInput";
import cuid2, { createId } from "@paralleldrive/cuid2";

interface PictureSelectionFormProps {
  localSurvey: TSurvey;
  question: TSurveyPictureSelectionQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
  showImageUploader?: boolean;
}

export default function PictureSelectionForm({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  showImageUploader = true,
}: PictureSelectionFormProps): JSX.Element {
  const environmentId = localSurvey.environmentId;

  const updateSurvey = (prop) => {
    // updateQuestion(questionIdx, updatedAttributes);
  };

  return (
    <form>
      <QuestionFormInput
        environmentId={environmentId}
        isInValid={isInValid}
        question={question}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
      />
      <div className="mt-2">
        <Label htmlFor="Images">Images</Label>
        <div className="mt-3 flex w-full items-center justify-center">
          <FileInput
            allowedFileExtensions={["png", "jpeg", "jpg"]}
            environmentId={environmentId}
            onFileUpload={(urls: string[]) => {
              updateQuestion(questionIdx, {
                choices: urls.map((url) => ({ imageUrl: url, id: createId() })),
              });
            }}
            fileUrl={question?.choices?.map((choice) => choice.imageUrl)}
            multiple={question.allowMulti}
          />
        </div>
      </div>

      <div className="my-4 flex items-center space-x-2">
        <Switch
          id="multi-select-toggle"
          checked={question.allowMulti}
          onClick={(e) => {
            e.stopPropagation();
            updateQuestion(questionIdx, { allowMulti: !question.allowMulti });
          }}
        />
        <Label htmlFor="multi-select-toggle" className="cursor-pointer">
          <div className="ml-2">
            <h3 className="text-sm font-semibold text-slate-700">Allow Multi Select</h3>
            <p className="text-xs font-normal text-slate-500">Allow users to select more than one image.</p>
          </div>
        </Label>
      </div>
    </form>
  );
}
