import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";
import { uploadFile } from "./lib/fileUpload";
import { TSurveyWelcomeQuestion } from "@formbricks/types/v1/surveys";

interface FileInputProps {
  question: TSurveyWelcomeQuestion;
  questionIdx: number;
  allowedFileExtensions: string[];
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  environmentId: string | undefined;
}

const FileInput: React.FC<FileInputProps> = ({
  question,
  questionIdx,
  allowedFileExtensions,
  updateQuestion,
  environmentId,
}) => {
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const selectedFile = e.dataTransfer.files[0];
    if (selectedFile) {
      try {
        const response = await uploadFile(selectedFile, allowedFileExtensions, environmentId);
        updateQuestion(questionIdx, { selectedFile: response.data.url });
      } catch (error) {
        console.error("Upload error:", error);
      }
    }
  };

  return (
    <label
      htmlFor="selectedFile"
      className="relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:hover:bg-gray-800"
      onDragOver={(e) => handleDragOver(e)}
      onDrop={(e) => handleDrop(e)}>
      {question.selectedFile ? (
        <>
          {question.selectedFile.endsWith(".pdf") ? (
            // This is currently not required for WelcomeType but is here for future compatiblity

            /*
            <img
              src="/path/to/pdf-icon.png"
              alt="PDF File"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
            */
            <></>
          ) : (
            <img
              src={question.selectedFile}
              alt="Company Logo"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 transition-opacity duration-300 hover:bg-opacity-60">
            <label htmlFor="selectedFile" className="cursor-pointer text-sm font-semibold text-white">
              Modify
            </label>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center pb-6 pt-5">
          <ArrowUpTrayIcon className="h-6 text-gray-500" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold">Click or drag to upload files.</span>
          </p>
        </div>
      )}
      <input
        type="file"
        id="selectedFile"
        name="selectedFile"
        accept={allowedFileExtensions.map((ext) => `.${ext}`).join(",")}
        className="hidden"
        onChange={async (e) => {
          const selectedFile = e.target?.files?.[0];
          if (selectedFile) {
            try {
              const response = await uploadFile(selectedFile, allowedFileExtensions, environmentId);
              updateQuestion(questionIdx, { selectedFile: response.data.url });
            } catch (error) {
              console.error("Upload error:", error);
            }
          }
        }}
      />
    </label>
  );
};

export default FileInput;
