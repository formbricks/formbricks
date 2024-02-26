import FileInput from "@formbricks/ui/FileInput";

interface ImageSurveyBgBgProps {
  environmentId: string;
  handleBgChange: (url: string, bgType: string) => void;
  background: string;
}

export default function ImageSurveyBg({ environmentId, handleBgChange, background }: ImageSurveyBgBgProps) {
  const isUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch (error) {
      return false;
    }
  };

  const fileUrl = isUrl(background ?? "") ? background ?? "" : "";

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
          fileUrl={fileUrl}
        />
      </div>
    </div>
  );
}
