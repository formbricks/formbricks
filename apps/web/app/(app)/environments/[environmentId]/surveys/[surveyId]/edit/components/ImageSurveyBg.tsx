import { TSurvey } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";

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

  const fileUrl = isUrl(localSurvey?.styling?.background?.bg ?? "")
    ? localSurvey?.styling?.background?.bg ?? ""
    : "";

  return (
    <div className="mt-2 w-full">
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
