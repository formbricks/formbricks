import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button, Checkbox, Input, Label } from "@formbricks/ui";
import GoogleSheetLogo from "@/images/google-sheets-small.png"
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Image from "next/image";
import Modal from "@/components/shared/Modal";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { upsertIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions";

interface AddWebhookModalProps {
  environmentId: string;
  open: boolean;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
  spreadsheets: any;
  integrations: any[]
}

export default function AddIntegrationModal({ environmentId, surveys, open, setOpen, spreadsheets, integrations }: AddWebhookModalProps) {
  const {
    handleSubmit,
    reset,
    register
  } = useForm();

  const integrationData = {
    spreadsheetId: "",
    spreadsheetName: "",
    surveyId: "",
    surveyName: "",
    questionIds: [""],
    questions:"",
    createdAt: new Date()
  };


  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [isLinkingSheet, setIsLinkingSheet] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<TSurvey | null>(null);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<any>();
  const existingIntegrationData = integrations.find((integration) => { return integration.type === "googleSheets" })?.config.data
  const googleSheetIntegration = {
    type: "googleSheets",
    environment: environmentId,
    config: {
      data: existingIntegrationData || []
    }
  }
  useEffect(() => {
    if (selectedSurvey) {
      const questionIds = selectedSurvey.questions.map((question) => question.id);
      setSelectedQuestions(questionIds);
    }
  }, [selectedSurvey])


  const linkSheet = () => {
    setIsLinkingSheet(true)
    integrationData.spreadsheetId = selectedSpreadsheet ? selectedSpreadsheet.id : "";
    integrationData.spreadsheetName = selectedSpreadsheet ? selectedSpreadsheet.name : "NA";
    integrationData.surveyId = selectedSurvey ? selectedSurvey.id : "";
    integrationData.surveyName = selectedSurvey ? selectedSurvey.name : "";
    integrationData.questionIds = selectedQuestions;
    integrationData.questions = selectedQuestions.length === selectedSurvey?.questions.length ? "All questions" : "Selected questions"
    integrationData.createdAt = new Date()
    googleSheetIntegration.config.data.push(integrationData);
    console.log(googleSheetIntegration)
    upsertIntegrationAction(environmentId, googleSheetIntegration)
      .then(() => {
        reset()
        setIsLinkingSheet(false)
        setOpen(false)
      })
      .catch((error) => {
        console.log(error)
      });
  }

  const handleCheckboxChange = (questionId: string) => {
    setSelectedQuestions((prevValues) =>
      prevValues.includes(questionId)
        ? prevValues.filter((value) => value !== questionId)
        : [...prevValues, questionId]
    );
  };

  const setOpenWithStates = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  return (
    <Modal open={open} setOpen={setOpenWithStates} noPadding closeOnOutsideClick={false}>
      {console.log(open)!}
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <Image className="w-12" src={GoogleSheetLogo} alt="Google Sheet logo" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Link Google Sheet</div>
                <div className="text-sm text-slate-500">Sync responses with a Google Sheet</div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(linkSheet)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div className="col-span-1">
                <Label htmlFor="name">Select Survey</Label>
                <div className="mt-1 flex">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300">
                        <span className="flex flex-1">
                          <span>{selectedSurvey ? selectedSurvey.name : "Select Survey"}</span>
                        </span>
                        <span className="flex h-full items-center border-l pl-3">
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        </span>
                      </button>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="min-w-[220px] rounded-md bg-white text-sm text-slate-800 shadow-md z-50"
                        align="start">
                        {
                          surveys.map((survey) => {
                            return <DropdownMenu.Item
                              key="test"
                              className="flex cursor-pointer items-center p-3 hover:bg-gray-100 hover:outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50"
                              onSelect={() => {
                                setSelectedSurvey(survey)
                              }
                              }>
                              {survey.name}
                            </DropdownMenu.Item>
                          })
                        }

                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>
              <div className="col-span-1">
                <Label htmlFor="spreadsheet">Select Spreadsheet</Label>
                <div className="mt-1 flex">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300">
                        <span className="flex flex-1">
                          <span>{selectedSpreadsheet ? selectedSpreadsheet.name : "Select Spreadsheet"}</span>
                        </span>
                        <span className="flex h-full items-center border-l pl-3">
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        </span>
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="min-w-[220px] rounded-md bg-white text-sm text-slate-800 shadow-md z-50"
                        align="start">
                        {
                          spreadsheets.map((spreadsheet) => {
                            return <DropdownMenu.Item
                              key="test"
                              className="flex cursor-pointer items-center p-3 hover:bg-gray-100 hover:outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50"
                              onSelect={() => {
                                setSelectedSpreadsheet(spreadsheet)
                              }
                              }>
                              {spreadsheet.name}
                            </DropdownMenu.Item>
                          })
                        }
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>
              {selectedSurvey && <div>
                <Label htmlFor="Surveys">Questions</Label>
                <div className="mt-1 rounded-lg border border-slate-200">
                  <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                    {selectedSurvey?.questions.map((question) => (
                      <div key={question.id} className="my-1 flex items-center space-x-2">
                        <label htmlFor={question.id} className="flex cursor-pointer items-center">
                          <Checkbox
                            type="button"
                            id={question.id}
                            value={question.id}
                            className="bg-white"
                            checked={selectedQuestions.includes(question.id)}
                            onCheckedChange={() => {
                              handleCheckboxChange(question.id)
                            }}
                          />
                          <span className="ml-2">{question.headline}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>}
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="minimal"
                onClick={() => {
                  setOpen(false);
                }}>
                Cancel
              </Button>
              <Button variant="darkCTA" type="submit" loading={isLinkingSheet}>
                Link Sheet
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
