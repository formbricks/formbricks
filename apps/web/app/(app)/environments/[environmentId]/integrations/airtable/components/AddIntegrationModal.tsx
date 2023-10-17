"use client";

import { TAirtableTables } from "@formbricks/types/v1/integration/lib/airTable";
import {
  TAirTableIntegration,
  TAirtable,
  TAirtableIntegrationInput,
  TAirTableConfigData,
} from "@formbricks/types/v1/integrations";
import { TSurvey } from "@/../../packages/types/v1/surveys";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/Alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { Button } from "@formbricks/ui/Button";
import { Checkbox } from "@formbricks/ui/Checkbox";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";
import AirtableLogo from "@/images/airtable.svg";
import { fetchTables } from "@/app/(app)/environments/[environmentId]/integrations/airtable/lib/airtable";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Control, Controller, UseFormSetValue, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { upsertIntegrationAction } from "../actions";

type EditModeProps =
  | { isEditMode: false; defaultData?: never }
  | { isEditMode: true; defaultData: IntegrationModalInputs & { index: number } };

type AddIntegrationModalProps = {
  open: boolean;
  setOpenWithStates: (v: boolean) => void;
  environmentId: string;
  airTableArray: TAirtable[];
  surveys: TSurvey[];
  airtableIntegration: TAirTableIntegration;
} & EditModeProps;

export type IntegrationModalInputs = {
  base: string;
  table: string;
  survey: string;
  questions: string[];
};

function NoBaseFoundError() {
  return (
    <Alert>
      <AlertTitle>No Airbase bases found</AlertTitle>
      <AlertDescription>create a Airbase base</AlertDescription>
    </Alert>
  );
}

interface BaseSelectProps {
  control: Control<IntegrationModalInputs, any>;
  isLoading: boolean;
  fetchTable: (val: string) => Promise<void>;
  airTableArray: TAirtable[];
  setValue: UseFormSetValue<IntegrationModalInputs>;
  defaultValue: string | undefined;
}

function BaseSelect({
  airTableArray,
  control,
  fetchTable,
  isLoading,
  setValue,
  defaultValue,
}: BaseSelectProps) {
  return (
    <div className="flex w-full flex-col">
      <Label htmlFor="base">Airtable base</Label>
      <div className="mt-1 flex">
        <Controller
          control={control}
          name="base"
          render={({ field }) => (
            <Select
              required
              disabled={isLoading}
              onValueChange={async (val) => {
                field.onChange(val);
                await fetchTable(val);
                setValue("table", "");
              }}
              defaultValue={defaultValue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {airTableArray.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
}

export default function AddIntegrationModal(props: AddIntegrationModalProps) {
  const {
    open,
    setOpenWithStates,
    environmentId,
    airTableArray,
    surveys,
    airtableIntegration,
    isEditMode,
    defaultData,
  } = props;
  const router = useRouter();
  const [tables, setTables] = useState<TAirtableTables["tables"]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { handleSubmit, control, watch, setValue, reset } = useForm<IntegrationModalInputs>();

  useEffect(() => {
    if (isEditMode) {
      const { index: _index, ...rest } = defaultData;
      reset(rest);
      fetchTable(defaultData.base);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  const survey = watch("survey");
  const selectedSurvey = surveys.find((item) => item.id === survey);
  const submitHandler = async (data: IntegrationModalInputs) => {
    try {
      if (!data.base || data.base === "") {
        throw new Error("Please select a base");
      }

      if (!data.table || data.table === "") {
        throw new Error("Please select a table");
      }

      if (!selectedSurvey) {
        throw new Error("Please select a survey");
      }

      if (data.questions.length === 0) {
        throw new Error("Please select at least one question");
      }

      const airtableIntegrationData: TAirtableIntegrationInput = {
        type: "airtable",
        config: {
          key: airtableIntegration?.config?.key,
          data: airtableIntegration.config.data ?? [],
          email: airtableIntegration?.config?.email,
        },
      };

      const currentTable = tables.find((item) => item.id === data.table);
      const integrationData: TAirTableConfigData = {
        surveyId: selectedSurvey.id,
        surveyName: selectedSurvey.name,
        questionIds: data.questions,
        questions:
          data.questions.length === selectedSurvey.questions.length ? "All questions" : "Selected questions",
        createdAt: new Date(),
        baseId: data.base,
        tableId: data.table,
        tableName: currentTable?.name ?? "",
      };

      if (isEditMode) {
        // update action
        airtableIntegrationData.config!.data[defaultData.index] = integrationData;
      } else {
        // create action
        airtableIntegrationData.config?.data.push(integrationData);
      }

      const actionMessage = isEditMode ? "updated" : "added";

      await upsertIntegrationAction(environmentId, airtableIntegrationData);
      toast.success(`Integration ${actionMessage} successfully`);
      handleClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleTable = async (baseId: string) => {
    const data = await fetchTables(environmentId, baseId);

    if (data.tables) {
      setTables(data.tables);
    }
  };

  const fetchTable = async (val: string) => {
    setIsLoading(true);
    await handleTable(val);
    setIsLoading(false);
  };

  const handleClose = () => {
    reset();
    setOpenWithStates(false);
  };

  const handleDelete = async (index: number) => {
    try {
      const integrationCopy = { ...airtableIntegration };
      integrationCopy.config.data.splice(index, 1);

      await upsertIntegrationAction(environmentId, integrationCopy);
      handleClose();
      router.refresh();

      toast.success(`Integration deleted successfully`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal open={open} setOpen={handleClose} noPadding>
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center justify-between p-6">
          <div className="flex items-center space-x-2">
            <div className="mr-1.5 h-6 w-6 text-slate-500">
              <Image className="w-12" src={AirtableLogo} alt="Airbase logo" />
            </div>
            <div>
              <div className="text-xl font-medium text-slate-700">Link Airbase Table</div>
              <div className="text-sm text-slate-500">Sync responses with a Airbase table</div>
            </div>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit(submitHandler)}>
        <div className="flex rounded-lg p-6">
          <div className="flex w-full flex-col gap-y-4 pt-5">
            {airTableArray.length ? (
              <BaseSelect
                control={control}
                isLoading={isLoading}
                fetchTable={fetchTable}
                airTableArray={airTableArray}
                setValue={setValue}
                defaultValue={defaultData?.base}
              />
            ) : (
              <NoBaseFoundError />
            )}

            <div className="flex w-full flex-col">
              <Label htmlFor="table">Table</Label>
              <div className="mt-1 flex">
                <Controller
                  control={control}
                  name="table"
                  render={({ field }) => (
                    <Select
                      required
                      disabled={!tables.length}
                      onValueChange={(val) => {
                        field.onChange(val);
                      }}
                      defaultValue={defaultData?.table}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      {tables.length ? (
                        <SelectContent>
                          {tables.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      ) : null}
                    </Select>
                  )}
                />
              </div>
            </div>

            {surveys.length ? (
              <div className="flex w-full flex-col">
                <Label htmlFor="survey">Select Survey</Label>
                <div className="mt-1 flex">
                  <Controller
                    control={control}
                    name="survey"
                    render={({ field }) => (
                      <Select
                        required
                        onValueChange={(val) => {
                          field.onChange(val);
                          setValue("questions", []);
                        }}
                        defaultValue={defaultData?.survey}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {surveys.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            ) : null}

            {!surveys.length ? (
              <p className="m-1 text-xs text-slate-500">
                You have to create a survey to be able to setup this integration
              </p>
            ) : null}

            {survey && selectedSurvey && (
              <div>
                <Label htmlFor="Surveys">Questions</Label>
                <div className="mt-1 rounded-lg border border-slate-200">
                  <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                    {selectedSurvey?.questions.map((question) => (
                      <Controller
                        key={question.id}
                        control={control}
                        name={"questions"}
                        render={({ field }) => (
                          <div className="my-1 flex items-center space-x-2">
                            <label htmlFor={question.id} className="flex cursor-pointer items-center">
                              <Checkbox
                                type="button"
                                id={question.id}
                                value={question.id}
                                className="bg-white"
                                checked={field.value?.includes(question.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, question.id])
                                    : field.onChange(field.value?.filter((value) => value !== question.id));
                                }}
                              />
                              <span className="ml-2">{question.headline}</span>
                            </label>
                          </div>
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-x-2">
              {isEditMode ? (
                <Button
                  onClick={async () => {
                    await handleDelete(defaultData.index);
                  }}
                  type="button"
                  loading={isLoading}
                  variant="warn">
                  Delete
                </Button>
              ) : (
                <Button type="button" loading={isLoading} variant="minimal" onClick={handleClose}>
                  Cancel
                </Button>
              )}

              <Button variant="darkCTA" type="submit">
                Save
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
