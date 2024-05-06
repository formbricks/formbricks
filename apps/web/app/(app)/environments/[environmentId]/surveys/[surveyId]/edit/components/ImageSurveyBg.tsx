import { FileInput } from "@formbricks/ui/FileInput";

interface UploadImageSurveyBgProps {
  environmentId: string;
  handleBgChange: (url: string, bgType: string) => void;
  background: string;
}

export const UploadImageSurveyBg = ({
  environmentId,
  handleBgChange,
  background,
}: UploadImageSurveyBgProps) => {
  return (
    <div className="mt-2 w-full">
      <div className="flex w-full items-center justify-center">
        <FileInput
          id="survey-bg-file-input"
          allowedFileExtensions={["png", "jpeg", "jpg"]}
          environmentId={environmentId}
          onFileUpload={(url: string[]) => {
            if (url.length > 0) {
              handleBgChange(url[0], "upload");
            } else {
              handleBgChange("", "upload");
            }
          }}
          fileUrl={background}
          maxSizeInMB={2}
        />
      </div>
    </div>
  );
};
