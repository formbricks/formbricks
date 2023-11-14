import FileInput from "@formbricks/ui/FileInput";
import { TSurvey } from "@formbricks/types/surveys";

interface ImageSurveyBgBgProps {
  localSurvey?: TSurvey;
  handleBgChange: (url: string, bgType: string) => void;
}

export default function ImageSurveyBg({ localSurvey, handleBgChange }: ImageSurveyBgBgProps) {
  const isUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch (error) {
      return false;
    }
  };

  const fileUrl = isUrl(localSurvey?.surveyBackground?.bg ?? "")
    ? localSurvey?.surveyBackground?.bg ?? ""
    : "";

  return (
    <div className="mb-2 mt-4 w-full rounded-lg border bg-slate-50 p-4">
      <div className="flex w-full items-center justify-center">
        <FileInput
          id="survey-bg-file-input"
          allowedFileExtensions={["png", "jpeg", "jpg"]}
          environmentId={localSurvey?.environmentId}
          onFileUpload={(url: string[]) => {
            if (url.length > 0) {
              handleBgChange(url[0], "image");
            } else {
              handleBgChange("#ffff", "color");
            }
          }}
          fileUrl={fileUrl}
        />
      </div>
    </div>
  );
}
