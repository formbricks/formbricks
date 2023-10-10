"use client";

import { md } from "@formbricks/lib/markdownIt";
import { TSurveyWelcomeQuestion, TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Editor, Input, Label, Switch } from "@formbricks/ui";
import { useState } from "react";
import { usePathname } from "next/navigation";

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
  const [firstRender, setFirstRender] = useState(true);
  const path = usePathname();
  console.log(path?.split("/environments/")[1]?.split("/")[0]);
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
          className="relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:hover:bg-gray-800">
          {question.companyLogo ? (
            <>
              <img
                src={question.companyLogo}
                alt="Company Logo"
                className="h-full w-full rounded-lg object-contain"
                style={{ maxHeight: "100%", maxWidth: "100%" }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 transition-opacity duration-300 hover:bg-opacity-60">
                <label htmlFor="companyLogo" className="cursor-pointer text-sm font-semibold text-white">
                  Modify
                </label>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center pb-6 pt-5">
              <svg
                className="mb-4 h-8 w-8 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 16">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                SVG, PNG, JPG or GIF (MAX. 800x400px)
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

      {/* Add Time to Finish Toggle */}
      <div className="mt-3 flex items-center">
        <div className="mr-2">
          <Switch
            id="timeToFinish"
            name="timeToFinish"
            checked={question.timeToFinish}
            onCheckedChange={() => updateQuestion(questionIdx, { timeToFinish: !question.timeToFinish })}
          />
        </div>
        <Label htmlFor="timeToFinish">Time to Finish</Label>
      </div>
    </form>
  );
}
