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
import GoogleSheetLogo from "@/images/google-sheets-small.png";
import {
  TAirTableIntegration,
  TAirtable,
  TZAirTableConfigData,
} from "@/../../packages/types/v1/integrations";
import { useEffect, useState, useTransition } from "react";
import { TAirtableTables } from "@/../../packages/lib/services/airTable";
import { TSurvey } from "@/../../packages/types/v1/surveys";
import { upsertIntegrationAction } from "./actions";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
  const [isPending, startTransition] = useTransition();
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
          email: airtableIntegration?.config.email ?? "",
        },
      };

      const currentTable = tables.find((item) => item.id === data.table);
      const integrationData: TZAirTableConfigData = {
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

  const fetchTable = (val: string) => {
    startTransition(async () => {
      await handleTable(val);
    });
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
    <Modal open={open} setOpen={setOpenWithStates} noPadding>
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center justify-between p-6">
          <div className="flex items-center space-x-2">
            <div className="mr-1.5 h-6 w-6 text-slate-500">
              <Image className="w-12" src={GoogleSheetLogo} alt="Airbase logo" />
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
            {isEditMode && isPending ? null : (
              <div className="flex w-full flex-col">
                <Label htmlFor="base">Airtable base</Label>
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
                          fetchTable(val);
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
            )}

            {tables.length ? (
              <div className="flex w-full flex-col">
                <Label htmlFor="table">Table</Label>
                <div className="mt-1 flex">
                  <Controller
                    control={control}
                    name="table"
                    render={({ field }) => (
                      <Select
                        required
                        disabled={isPending}
                        onValueChange={(val) => {
                          field.onChange(val);
                          setValue("questions", []);
                        }}
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
                <Label htmlFor="survey">Select Survey</Label>
                <div className="mt-1 flex">
                  <Controller
                    control={control}
                    name="survey"
                    render={({ field }) => (
                      <Select
                        required
                        disabled={isPending}
                        onValueChange={(val) => {
                          field.onChange(val);
                          setValue("questions", []);
                        }}
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

            {survey && selectedSurvey && !isPending && (
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
                  onClick={() => {
                    startTransition(async () => {
                      await handleDelete(defaultData.index);
                    });
                  }}
                  loading={isPending}
                  type="button"
                  variant="warn">
                  Delete
                </Button>
              ) : (
                <Button type="button" variant="minimal" onClick={handleClose}>
                  Cancel
                </Button>
              )}

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
