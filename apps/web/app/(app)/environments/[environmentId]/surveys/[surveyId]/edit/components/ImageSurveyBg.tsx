import FileInput from "@formbricks/ui/FileInput";

export default function ImageSurveyBg({ localSurvey, handleBgChange }) {
  return (
    <div className="mb-2 mt-4 w-full rounded-lg border bg-slate-50 p-4">
      <div className="mt-3 flex w-full items-center justify-center">
        <FileInput
          allowedFileExtensions={["png", "jpeg", "jpg"]}
          environmentId={localSurvey.environmentId}
          onFileUpload={(url: string) => {
            handleBgChange(url, "image");
          }}
          fileUrl={localSurvey?.welcomeCard?.fileUrl}
        />
      </div>
    </div>
  );
}
