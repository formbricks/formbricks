import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
  Checkbox,
} from "@/../../packages/ui";
import Modal from "@/components/shared/Modal";
import { Controller, useForm } from "react-hook-form";
import { fetchTables } from "@formbricks/lib/client/airtable";
import { toast } from "react-hot-toast";

import {
  TAirTableIntegration,
  TAirtable,
  TZAirTableConfigData,
} from "@/../../packages/types/v1/integrations";
import { useState, useTransition } from "react";
import { TAirtableTables } from "@/../../packages/lib/services/airTable";
import { TSurvey } from "@/../../packages/types/v1/surveys";
import { upsertIntegrationAction } from "./actions";

interface AddIntegrationModalProps {
  open: boolean;
  setOpenWithStates: (v: boolean) => void;
  environmentId: string;
  airTableArray: TAirtable[];
  surveys: TSurvey[];
  airtableIntegration: TAirTableIntegration | undefined;
}

type Inputs = {
  base: string;
  table: string;
  survey: string;
  questions: string[];
};

export default function AddIntegrationModal(props: AddIntegrationModalProps) {
  const { open, setOpenWithStates, environmentId, airTableArray, surveys, airtableIntegration } = props;
  const [tables, setTables] = useState<TAirtableTables["tables"]>([]);
  const [isPending, startTransition] = useTransition();
  const {
    handleSubmit,
    control,
    watch,
    setValue,

    reset,
  } = useForm<Inputs>();
  const survey = watch("survey");
  const questions = watch("questions", []);
  const selectedSurvey = surveys.find((item) => item.id === survey);
  const submitHandler = async (data: Inputs) => {
    try {
      if (!data.base) {
        throw new Error("Please select a base");
      }

      if (!data.table) {
        throw new Error("Please select a table");
      }

      if (!selectedSurvey) {
        throw new Error("Please select a survey");
      }

      if (data.questions.length === 0) {
        throw new Error("Please select at least one question");
      }

      const airtableIntegrationData: Partial<TAirTableIntegration> = {
        type: "airtable",
        config: {
          key: airtableIntegration?.config.key ?? "",
          data: airtableIntegration?.config.data ?? [],
        },
      };

      const integrationData: TZAirTableConfigData = {
        surveyId: selectedSurvey.id,
        surveyName: selectedSurvey.name,
        questionIds: data.questions,
        questions:
          data.questions.length === selectedSurvey.questions.length ? "All questions" : "Selected questions",
        createdAt: new Date(),
        baseId: data.base,
        tableId: data.table,
      };

      airtableIntegrationData.config?.data.push(integrationData);

      await upsertIntegrationAction(environmentId, airtableIntegrationData);
      toast.success(`Integration added successfully`);
      reset();
      setOpenWithStates(false);
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

  return (
    <Modal open={open} setOpen={setOpenWithStates} noPadding>
      <form onSubmit={handleSubmit(submitHandler)}>
        <div className="flex rounded-lg p-6">
          <div className="flex w-full flex-col gap-y-4 pt-5">
            <div className="flex w-full flex-col">
              <Label htmlFor="token">Airtable base</Label>
              <div className="mt-1 flex">
                <Controller
                  control={control}
                  name="base"
                  render={({ field }) => (
                    <Select
                      required
                      disabled={isPending}
                      onValueChange={async (val) => {
                        field.onChange(val);
                        startTransition(async () => {
                          await handleTable(val);
                        });
                      }}
                      defaultValue={field.value}>
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

            {tables.length ? (
              <div className="flex w-full flex-col">
                <Label htmlFor="token">Table</Label>
                <div className="mt-1 flex">
                  <Controller
                    control={control}
                    name="table"
                    render={({ field }) => (
                      <Select
                        required
                        disabled={isPending}
                        onValueChange={field.onChange}
                        defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tables.map((item) => (
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

            {tables.length && surveys.length ? (
              <div className="flex w-full flex-col">
                <Label htmlFor="token">Select Survey</Label>
                <div className="mt-1 flex">
                  <Controller
                    control={control}
                    name="survey"
                    render={({ field }) => (
                      <Select
                        required
                        disabled={isPending}
                        onValueChange={field.onChange}
                        defaultValue={field.value}>
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

            {tables.length && !surveys.length ? (
              <p className="m-1 text-xs text-slate-500">
                You have to create a survey to be able to setup this integration
              </p>
            ) : null}

            {survey && selectedSurvey && (
              <div>
                <Label htmlFor="Surveys">Questions</Label>
                <div className="mt-1 rounded-lg border border-slate-200">
                  <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                    {selectedSurvey?.questions.map((question, i) => (
                      <Controller
                        key={question.id}
                        control={control}
                        name={`questions.${i}`}
                        render={() => (
                          <div className="my-1 flex items-center space-x-2">
                            <label htmlFor={question.id} className="flex cursor-pointer items-center">
                              <Checkbox
                                type="button"
                                id={question.id}
                                value={question.id}
                                className="bg-white"
                                onCheckedChange={(val) => {
                                  if (val) {
                                    setValue("questions", [...questions, question.id]);
                                  } else {
                                    const newValue = [...questions].filter((id) => id !== question.id);
                                    setValue("questions", newValue);
                                  }
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

            <div className="flex justify-end ">
              <Button loading={isPending} type="submit">
                save
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
