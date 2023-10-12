"use client";

import { md } from "@formbricks/lib/markdownIt";
import { TSurveyWelcomeQuestion, TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Editor } from "@formbricks/ui/Editor";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";

interface WelcomeQuestionFormProps {
  localSurvey: TSurveyWithAnalytics;
  question: TSurveyWelcomeQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
}

export default function WelcomeQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInValid,
}: WelcomeQuestionFormProps): JSX.Element {
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const selectedFile = e.dataTransfer.files[0];
    if (selectedFile) {
      try {
        const response = await uploadFile(selectedFile);
        updateQuestion(questionIdx, { companyLogo: response.data.url });
      } catch (error) {
        console.error("Upload error:", error);
      }
    }
  }

  const [firstRender, setFirstRender] = useState(true);
  const path = usePathname();
  const uploadFile = async (file) => {
    try {
      if (!(file instanceof Blob) || !(file instanceof File)) {
        throw new Error(`Invalid file type. Expected Blob or File, but received ${typeof file}`);
      }

      const fileBuffer = await file.arrayBuffer();

      const payload = {
        fileBuffer: Array.from(new Uint8Array(fileBuffer)),
        fileName: file.name,
        contentType: file.type,
        environmentId: `${path?.split("/environments/")[1]?.split("/")[0]}`,
        allowedFileExtensions: ["png", "jpeg", "jpg"],
      };

      const response = await fetch("/api/v1/management/storage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

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
        <Label htmlFor="subheader">Description</Label>
        <div className="mt-2">
          <Editor
            getText={() =>
              md.render(
                question.html || "We would love to talk to you and learn more about how you use our product."
              )
            }
            setText={(value: string) => {
              updateQuestion(questionIdx, { html: value });
            }}
            excludedToolbarItems={["blockType"]}
            disableLists
            firstRender={firstRender}
            setFirstRender={setFirstRender}
          />
        </div>
      </div>
      <div className="mt-3 flex w-full items-center justify-center">
        <label
          htmlFor="companyLogo"
          className="relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:hover:bg-gray-800"
          onDragOver={(e) => handleDragOver(e)}
          onDrop={(e) => handleDrop(e)}>
          {question.companyLogo ? (
            <>
              <img
                src={question.companyLogo}
                alt="Company Logo"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 transition-opacity duration-300 hover:bg-opacity-60">
                <label htmlFor="companyLogo" className="cursor-pointer text-sm font-semibold text-white">
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
            id="companyLogo"
            name="companyLogo"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const selectedFile = e.target?.files?.[0];
              if (selectedFile) {
                try {
                  const response = await uploadFile(selectedFile);
                  updateQuestion(questionIdx, { companyLogo: response.data.url });
                } catch (error) {
                  console.error("Upload error:", error);
                }
              }
            }}
          />
        </label>
      </div>
      <div className="mt-3 flex justify-between gap-8">
        <div className="flex w-full space-x-2">
          <div className="w-full">
            <Label htmlFor="buttonLabel">Button Label</Label>
            <div className="mt-2">
              <Input
                id="buttonLabel"
                name="buttonLabel"
                value={question.buttonLabel}
                placeholder={lastQuestion ? "Finish" : "Next"}
                onChange={(e) => updateQuestion(questionIdx, { buttonLabel: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center">
        <div className="mr-2">
          <Switch
            id="timeToFinish"
            name="timeToFinish"
            checked={question.timeToFinish}
            onCheckedChange={() => updateQuestion(questionIdx, { timeToFinish: !question.timeToFinish })}
          />
        </div>
        <div className="flex-column ">
          <Label htmlFor="timeToFinish" className="">
            Time to Finish
          </Label>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Display an estimate of completion time for survey
          </div>
        </div>
      </div>
    </form>
  );
}
