import FileInput from "@formbricks/ui/FileInput";

interface ImageSurveyBgProps {
  environmentId: string;
  handleBgChange: (url: string, bgType: string) => void;
  background: string;
}

export const ImageSurveyBg = ({ environmentId, handleBgChange, background }: ImageSurveyBgProps) => {
  return (
    <div className="mt-2 w-full">
      <div className="flex w-full items-center justify-center">
        <FileInput
          id="survey-bg-file-input"
          allowedFileExtensions={["png", "jpeg", "jpg"]}
          environmentId={environmentId}
          onFileUpload={(url: string[]) => {
            if (url.length > 0) {
              handleBgChange(url[0], "image");
            } else {
              handleBgChange("", "image");
            }
          }}
          fileUrl={background}
          maxSizeInMB={2}
        />
      </div>
    </div>
  );
};
