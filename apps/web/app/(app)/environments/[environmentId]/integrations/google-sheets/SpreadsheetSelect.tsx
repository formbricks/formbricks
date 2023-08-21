"use client"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { Button } from "@formbricks/ui";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { upsertIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions";

export default function SpreadsheetSelect({ environmentId, spreadsheet, selectedSurvey, integrations, setConfigCompleted }) {
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState()
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState()
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const existingIntegrationData = integrations.find((integration) => { return integration.type === "googleSheets" })?.config.data
  const googleSheetIntegration = {
    type: "googleSheets",
    environment: environmentId,
    config: {
      data: existingIntegrationData || []
    }
  }
  const integrationData = {
    spreadsheetId: "",
    spreadsheetName: "",
    surveyId: "",
    surveyName: "",
    questionIds: [""]
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-center text-2xl font-semibold my-2">Configure your Google Sheet Integration</h2>
      <p className="text-center">Select a Spreadsheet and questions you wish to send to that spreadsheet</p>
      <div className="mt-4">
        <div className="rounded-lg bg-white p-6 shadow w-3/4 mx-auto">
          <div>
            <div className="mt-6">
              <p className="font-medium">Select Spreadsheet</p>
              <div className="mt-4">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300">
                      <span className="flex flex-1">
                        <span>{selectedSpreadsheet ? selectedSpreadsheet : "Select spreadsheet"}</span>
                      </span>
                      <span className="flex h-full items-center border-l pl-3">
                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                      </span>
                    </button>
                  </DropdownMenu.Trigger>

                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="min-w-[220px] rounded-md bg-white text-sm text-slate-800 shadow-md"
                      align="start">
                      {
                        spreadsheet.map((ele) => {
                          return <DropdownMenu.Item
                            key="test"
                            className="flex cursor-pointer items-center p-3 hover:bg-gray-100 hover:outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50"
                            onSelect={() => {
                              setSelectedSpreadsheet(ele.name)
                              setSelectedSpreadsheetId(ele.id)
                              console.log(ele.id)
                            }
                            }>
                            {ele.name}
                          </DropdownMenu.Item>
                        })
                      }

                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>
            <div className="mt-6">
              <p className="font-medium">Select Survey questions to send to Google Sheets</p>
              <div className="mt-4">
                {selectedSurvey.questions.map((question) => (
                  <span className="flex items-center my-2" key={question.id}>
                    <input
                      type="checkbox"
                      id={question.id}
                      name={question.id}
                      value={question.headline}
                      checked={selectedQuestions.includes(question.id)}
                      onChange={(event) => {
                        const selectedQuestionId = question.id;
                        if (event.target.checked) {
                          setSelectedQuestions((prevSelected) => [...prevSelected, selectedQuestionId]);
                        } else {
                          setSelectedQuestions((prevSelected) => prevSelected.filter(id => id !== selectedQuestionId));
                        }
                      }}
                      className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
                      aria-labelledby={`${question.id}-label`}
                    />
                    <span id={`${question.id}-label`} className="ml-3">
                      {question.headline}
                    </span>
                  </span>
                ))}
                <Button variant="minimal" className="mt-4" onClick={()=>{
                   setSelectedQuestions(selectedSurvey.questions.map(question => question.id));
                }
                }>Select all
                </Button>
              </div>
            </div>

          </div>
        </div>
        <div className="flex justify-between w-3/4 mx-auto mt-4">
          <Button variant="secondary">cancel</Button>
          <Button variant="primary" loading={loading} disabled={!selectedSpreadsheet || selectedQuestions.length === 0} onClick={() => {
            setLoading(true)
            integrationData.spreadsheetId = selectedSpreadsheetId ? selectedSpreadsheetId : "";
            integrationData.spreadsheetName = selectedSpreadsheet ? selectedSpreadsheet : "NA";
            integrationData.surveyId = selectedSurvey.id;
            integrationData.surveyName = selectedSurvey.name;
            integrationData.questionIds = selectedQuestions;
            // Call the createIntegrationAction function with integrationData
            googleSheetIntegration.config.data.push(integrationData);
            console.log(googleSheetIntegration)
            upsertIntegrationAction(environmentId, googleSheetIntegration)
              .then(() => {
                setLoading(false)
                setConfigCompleted(true)
              })
              .catch((error) => {
                console.log(error)
              });
          }}>
           Save
          </Button>

        </div>
      </div>
    </div>
  )
}
