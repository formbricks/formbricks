import { TSurvey, TSurveyFileUploadQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { toast } from "react-hot-toast";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useMemo, useState } from "react";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { TAllowedFileExtension, ZAllowedFileExtension } from "@formbricks/types/common";
import { TProduct } from "@formbricks/types/product";

interface FileUploadFormProps {
  localSurvey: TSurvey;
  product?: TProduct;
  question: TSurveyFileUploadQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
}

export default function FileUploadQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  product,
}: FileUploadFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const [extension, setExtension] = useState("");

  const handleInputChange = (event) => {
    setExtension(event.target.value);
  };

  const addExtension = () => {
    const parsedExtensionResult = ZAllowedFileExtension.safeParse(extension);

    if (!parsedExtensionResult.success) {
      toast.error("This extension is not supported");
      return;
    }

    if (question.allowedFileTypes) {
      if (!question.allowedFileTypes.includes(extension as TAllowedFileExtension)) {
        updateQuestion(questionIdx, {
          allowedFileTypes: [...question.allowedFileTypes, extension],
        });
        setExtension("");
      } else {
        toast.error("This extension is already added");
      }
    } else {
      updateQuestion(questionIdx, { allowedFileTypes: [extension] });
      setExtension("");
    }
  };

  const removeExtension = (index: number) => {
    if (question.allowedFileTypes) {
      const updatedExtensions = [...question?.allowedFileTypes];
      updatedExtensions.splice(index, 1);
      updateQuestion(questionIdx, { allowedFileTypes: updatedExtensions });
    }
  };

  const maxSizeInMBLimit = useMemo(() => {
    if (!product || !product?.billingInfo) {
      return 10;
    }

    if (product.billingInfo.features.linkSurvey.status === "active") {
      // 1GB in MB
      return 1024;
    }

    return 10;
  }, [product]);

  return (
    <form>
      <div className="mt-3">
        <Label htmlFor="headline">Question</Label>
        <div className="mt-2">
          <Input
            autoFocus
            id="headline"
            name="headline"
            value={question.headline}
            onChange={(e) => updateQuestion(questionIdx, { headline: e.target.value })}
            isInvalid={isInValid && question.headline.trim() === ""}
          />
        </div>
      </div>
      <div className="mt-3">
        {showSubheader && (
          <>
            <Label htmlFor="subheader">Description</Label>
            <div className="mt-2 inline-flex w-full items-center">
              <Input
                id="subheader"
                name="subheader"
                value={question.subheader}
                onChange={(e) => updateQuestion(questionIdx, { subheader: e.target.value })}
              />
              <TrashIcon
                className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                onClick={() => {
                  setShowSubheader(false);
                  updateQuestion(questionIdx, { subheader: "" });
                }}
              />
            </div>
          </>
        )}
        {!showSubheader && (
          <Button size="sm" variant="minimal" type="button" onClick={() => setShowSubheader(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>
      {/* Add a dropdown to select the question type */}
      <div className="mt-8 flex items-center">
        <div className="mr-2">
          <Switch
            id="m"
            name="allowMultipleFile"
            checked={question.allowMultipleFiles}
            onCheckedChange={() =>
              updateQuestion(questionIdx, { allowMultipleFiles: !question.allowMultipleFiles })
            }
          />
        </div>
        <div className="flex-column">
          <Label htmlFor="allowMultipleFile" className="">
            Allow Multiple Files
          </Label>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Let people upload up to 10 files at the same time.
          </div>
        </div>
      </div>

      <div className="mt-8">
        <AdvancedOptionToggle
          isChecked={!!question.maxSizeInMB}
          onToggle={(checked) => updateQuestion(questionIdx, { maxSizeInMB: checked ? 10 : null })}
          htmlId="limitFileType"
          title="Max file size"
          description="Limit the maximum file size."
          childBorder
          customContainerClass="p-0">
          <label htmlFor="autoCompleteResponses" className="cursor-pointer bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Limit upload file size to
              <Input
                autoFocus
                type="number"
                id="fileSizeLimit"
                value={question.maxSizeInMB}
                onChange={(e) => {
                  const parsedValue = parseInt(e.target.value, 10);

                  if (parsedValue > maxSizeInMBLimit) {
                    toast.error(`Max file size limit is ${maxSizeInMBLimit} MB`);
                    updateQuestion(questionIdx, { maxSizeInMB: maxSizeInMBLimit });
                    return;
                  }

                  updateQuestion(questionIdx, { maxSizeInMB: parseInt(e.target.value, 10) });
                }}
                className="ml-2 mr-2 inline w-20 bg-white text-center text-sm"
              />
              MB
            </p>
          </label>
        </AdvancedOptionToggle>
      </div>

      <div className="mt-8 flex items-center">
        <div className="mr-2">
          <Switch
            id="m"
            name="limitFileType"
            checked={!!question.allowedFileTypes}
            onCheckedChange={(checked) =>
              updateQuestion(questionIdx, { allowedFileTypes: checked ? [] : null })
            }
          />
        </div>
        <div className="flex-column">
          <Label htmlFor="limitFileType">Allowed file types</Label>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Control which file types can be uploaded.
          </div>
        </div>
      </div>
      {!!question.allowedFileTypes && (
        <div className="mt-3">
          <div className="mt-2 flex w-full items-center justify-start gap-2 rounded-md border bg-slate-50 p-4">
            {question.allowedFileTypes &&
              question?.allowedFileTypes.map((item, index) => {
                return (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 p-2">
                    <p>{item}</p>
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-50"
                      onClick={() => removeExtension(index)}>
                      -
                    </div>
                  </div>
                );
              })}
            <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 p-2">
              <input
                className="w-16 rounded-md border-none py-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="pdf"
                value={extension}
                onChange={handleInputChange}
                type="text"
              />
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-50"
                onClick={addExtension}>
                +
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
