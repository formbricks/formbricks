import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { getSpreadsheetNameByIdAction } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions";
import {
  constructGoogleSheetsUrl,
  extractSpreadsheetIdFromUrl,
  isValidGoogleSheetsUrl,
} from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/lib/util";
import GoogleSheetLogo from "@/images/googleSheetsLogo.png";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfigData,
  TIntegrationGoogleSheetsInput,
} from "@formbricks/types/integration/google-sheet";
import { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { AdditionalIntegrationSettings } from "@formbricks/ui/components/AdditionalIntegrationSettings";
import { Button } from "@formbricks/ui/components/Button";
import { Checkbox } from "@formbricks/ui/components/Checkbox";
import { DropdownSelector } from "@formbricks/ui/components/DropdownSelector";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import { Modal } from "@formbricks/ui/components/Modal";

interface AddIntegrationModalProps {
  environmentId: string;
  open: boolean;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
  googleSheetIntegration: TIntegrationGoogleSheets;
  selectedIntegration?: (TIntegrationGoogleSheetsConfigData & { index: number }) | null;
  attributeClasses: TAttributeClass[];
}

export const AddIntegrationModal = ({
  environmentId,
  surveys,
  open,
  setOpen,
  googleSheetIntegration,
  selectedIntegration,
  attributeClasses,
}: AddIntegrationModalProps) => {
  const t = useTranslations();
  const integrationData: TIntegrationGoogleSheetsConfigData = {
    spreadsheetId: "",
    spreadsheetName: "",
    surveyId: "",
    surveyName: "",
    questionIds: [""],
    questions: "",
    createdAt: new Date(),
  };
  const { handleSubmit } = useForm();
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [isLinkingSheet, setIsLinkingSheet] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<TSurvey | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const existingIntegrationData = googleSheetIntegration?.config?.data;
  const [includeVariables, setIncludeVariables] = useState(false);
  const [includeHiddenFields, setIncludeHiddenFields] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const googleSheetIntegrationData: TIntegrationGoogleSheetsInput = {
    type: "googleSheets",
    config: {
      key: googleSheetIntegration?.config?.key,
      email: googleSheetIntegration.config.email,
      data: existingIntegrationData || [],
    },
  };

  useEffect(() => {
    if (selectedSurvey && !selectedIntegration) {
      const questionIds = selectedSurvey.questions.map((question) => question.id);
      setSelectedQuestions(questionIds);
    }
  }, [selectedIntegration, selectedSurvey]);

  useEffect(() => {
    if (selectedIntegration) {
      setSpreadsheetUrl(constructGoogleSheetsUrl(selectedIntegration.spreadsheetId));
      setSelectedSurvey(
        surveys.find((survey) => {
          return survey.id === selectedIntegration.surveyId;
        })!
      );
      setSelectedQuestions(selectedIntegration.questionIds);
      setIncludeVariables(!!selectedIntegration.includeVariables);
      setIncludeHiddenFields(!!selectedIntegration.includeHiddenFields);
      setIncludeMetadata(!!selectedIntegration.includeMetadata);
      return;
    } else {
      setSpreadsheetUrl("");
    }
    resetForm();
  }, [selectedIntegration, surveys]);

  const linkSheet = async () => {
    try {
      if (!isValidGoogleSheetsUrl(spreadsheetUrl)) {
        throw new Error(t("environments.integrations.google_sheets.enter_a_valid_spreadsheet_url_error"));
      }
      if (!selectedSurvey) {
        throw new Error(t("environments.integrations.select_a_survey_error"));
      }
      if (selectedQuestions.length === 0) {
        throw new Error(t("environments.integrations.select_at_least_one_question_error"));
      }
      const spreadsheetId = extractSpreadsheetIdFromUrl(spreadsheetUrl);
      const spreadsheetName = await getSpreadsheetNameByIdAction(
        googleSheetIntegration,
        environmentId,
        spreadsheetId
      );

      setIsLinkingSheet(true);
      integrationData.spreadsheetId = spreadsheetId;
      integrationData.spreadsheetName = spreadsheetName;
      integrationData.surveyId = selectedSurvey.id;
      integrationData.surveyName = selectedSurvey.name;
      integrationData.questionIds = selectedQuestions;
      integrationData.questions =
        selectedQuestions.length === selectedSurvey?.questions.length
          ? t("common.all_questions")
          : t("common.selected_questions");
      integrationData.createdAt = new Date();
      integrationData.includeVariables = includeVariables;
      integrationData.includeHiddenFields = includeHiddenFields;
      integrationData.includeMetadata = includeMetadata;
      if (selectedIntegration) {
        // update action
        googleSheetIntegrationData.config!.data[selectedIntegration.index] = integrationData;
      } else {
        // create action
        googleSheetIntegrationData.config!.data.push(integrationData);
      }
      await createOrUpdateIntegrationAction({ environmentId, integrationData: googleSheetIntegrationData });
      if (selectedIntegration) {
        toast.success(t("environments.integrations.integration_updated_successfully"));
      } else {
        toast.success(t("environments.integrations.integration_added_successfully"));
      }
      resetForm();
      setOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsLinkingSheet(false);
    }
  };

  const handleCheckboxChange = (questionId: TSurveyQuestionId) => {
    setSelectedQuestions((prevValues) =>
      prevValues.includes(questionId)
        ? prevValues.filter((value) => value !== questionId)
        : [...prevValues, questionId]
    );
  };

  const setOpenWithStates = (isOpen: boolean) => {
    resetForm();
    setOpen(isOpen);
  };

  const resetForm = () => {
    setSpreadsheetUrl("");
    setIsLinkingSheet(false);
    setSelectedSurvey(null);
    setIncludeHiddenFields(false);
    setIncludeMetadata(false);
  };

  const deleteLink = async () => {
    googleSheetIntegrationData.config!.data.splice(selectedIntegration!.index, 1);
    try {
      setIsDeleting(true);
      await createOrUpdateIntegrationAction({ environmentId, integrationData: googleSheetIntegrationData });
      toast.success(t("environments.integrations.integration_removed_successfully"));
      setOpen(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal open={open} setOpen={setOpenWithStates} noPadding closeOnOutsideClick={true}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <Image
                  className="w-12"
                  src={GoogleSheetLogo}
                  alt={t("environments.integrations.google_sheets.google_sheet_logo")}
                />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  {t("environments.integrations.google_sheets.link_google_sheet")}
                </div>
                <div className="text-sm text-slate-500">
                  {t("environments.integrations.google_sheets.google_sheets_integration_description")}
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(linkSheet)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <div className="mb-4">
                  <Label>{t("environments.integrations.google_sheets.spreadsheet_url")}</Label>
                  <Input
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>"
                    className="mt-1"
                  />
                </div>
                <div>
                  <DropdownSelector
                    label={t("common.select_survey")}
                    items={surveys}
                    selectedItem={selectedSurvey}
                    setSelectedItem={setSelectedSurvey}
                    disabled={surveys.length === 0}
                  />
                  <p className="m-1 text-xs text-slate-500">
                    {surveys.length === 0 && t("environments.integrations.create_survey_warning")}
                  </p>
                </div>
              </div>
              {selectedSurvey && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="Surveys">{t("common.questions")}</Label>
                    <div className="mt-1 max-h-[15vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200">
                      <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                        {replaceHeadlineRecall(selectedSurvey, "default", attributeClasses)?.questions.map(
                          (question) => (
                            <div key={question.id} className="my-1 flex items-center space-x-2">
                              <label htmlFor={question.id} className="flex cursor-pointer items-center">
                                <Checkbox
                                  type="button"
                                  id={question.id}
                                  value={question.id}
                                  className="bg-white"
                                  checked={selectedQuestions.includes(question.id)}
                                  onCheckedChange={() => {
                                    handleCheckboxChange(question.id);
                                  }}
                                />
                                <span className="ml-2 w-[30rem] truncate">
                                  {getLocalizedValue(question.headline, "default")}
                                </span>
                              </label>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <AdditionalIntegrationSettings
                    includeVariables={includeVariables}
                    setIncludeVariables={setIncludeVariables}
                    includeHiddenFields={includeHiddenFields}
                    includeMetadata={includeMetadata}
                    setIncludeHiddenFields={setIncludeHiddenFields}
                    setIncludeMetadata={setIncludeMetadata}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              {selectedIntegration ? (
                <Button
                  type="button"
                  variant="warn"
                  loading={isDeleting}
                  onClick={() => {
                    deleteLink();
                  }}>
                  {t("common.delete")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="minimal"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}>
                  {t("common.cancel")}
                </Button>
              )}
              <Button type="submit" loading={isLinkingSheet}>
                {selectedIntegration
                  ? t("common.update")
                  : t("environments.integrations.google_sheets.link_google_sheet")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
