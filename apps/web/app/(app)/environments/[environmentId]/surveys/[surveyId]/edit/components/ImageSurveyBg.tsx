import FileInput from "@formbricks/ui/FileInput";
import { TSurvey } from "@formbricks/types/surveys";

interface ImageSurveyBgBgProps {
  localSurvey?: TSurvey;
  handleBgChange: (url: string, bgType: string) => void;
}

export default function ImageSurveyBg({ localSurvey, handleBgChange }: ImageSurveyBgBgProps) {
  return (
    <div className="mb-2 mt-4 w-full rounded-lg border bg-slate-50 p-4">
      <div className="mt-3 flex w-full items-center justify-center">
        <FileInput
          id="choices-file-input"
          allowedFileExtensions={["png", "jpeg", "jpg"]}
          environmentId={localSurvey?.environmentId}
          onFileUpload={(url: string[]) => {
            handleBgChange(url[0], "image");
          }}
          // fileUrl={localSurvey?.surveyBackground?.bg}
        />
      </div>
    </div>
  );
}
