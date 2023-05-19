"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Modal from "@/components/shared/Modal";
import { useSurveys } from "@/lib/surveys/surveys";
import { Button, Checkbox, Input, Label } from "@formbricks/ui";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useFieldArray, useForm } from "react-hook-form";

interface NotificationModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: FormData) => void;
  environmentId: string;
}

interface FormData {
  name: string;
  everyResponse: boolean;
  weeklySummary: boolean;
  allSurveys: boolean;
  surveys: Record<string, boolean>; // represents dynamic survey IDs
  emails: { email: string }[];
}

export default function AddNotificationModal({
  open,
  setOpen,
  onSubmit,
  environmentId,
}: NotificationModalProps) {
  const { surveys, isLoadingSurveys, isErrorSurveys } = useSurveys(environmentId);

  const { register, control, handleSubmit, reset, getValues } = useForm<FormData>({
    defaultValues: { emails: [{ email: "" }] },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "emails",
  });

  // ChatGPT suggestion on how to check and uncheck all surveys based on "All survey"

  /* const [checkedSurveys, setCheckedSurveys] = useState({});

   const handleAllSurveysCheck = (checked) => {
    let newCheckedSurveys = { ...checkedSurveys };

    surveys.forEach((survey) => {
      newCheckedSurveys[survey.id] = checked;
    });

    setCheckedSurveys(newCheckedSurveys);
  };

  const handleSingleSurveyCheck = (checked, surveyId) => {
    setCheckedSurveys((prev) => ({
      ...prev,
      [surveyId]: checked,
    }));

    if (!checked && checkedSurveys["any-survey"]) {
      setCheckedSurveys((prev) => ({
        ...prev,
        "any-survey": false,
      }));
    }
  };

  useEffect(() => {
    const allChecked = surveys.every((survey) => checkedSurveys[survey.id]);

    if (allChecked && !checkedSurveys["any-survey"]) {
      setCheckedSurveys((prev) => ({
        ...prev,
        "any-survey": true,
      }));
    }
  }, [checkedSurveys]); */

  const submitEventClass = async () => {
    const data = getValues();
    onSubmit(data);
    setOpen(false);
    reset();
  };

  if (isLoadingSurveys) {
    return <LoadingSpinner />;
  }

  if (isErrorSurveys) {
    return <div>Error</div>;
  }

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={true}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-medium text-slate-700">Add Email Alert</div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitEventClass)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <Label>Alert Name</Label>
                <Input placeholder="e.g. Product Team Info" {...register("name", { required: true })} />
              </div>
              <div>
                <Label>Alert Type</Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center">
                    <Checkbox id="every-response" {...register("everyResponse")} />
                    <Label htmlFor="every-response" className="ml-2 text-base font-normal">
                      Send single responses
                    </Label>
                  </div>
                  <div className="flex items-center">
                    <Checkbox id="weekly-summary" {...register("weeklySummary")} />
                    <Label htmlFor="weekly-summary" className="ml-2 text-base font-normal">
                      Send weekly summary
                    </Label>
                  </div>
                </div>
              </div>
              <div>
                <Label>Trigger by Survey</Label>
                <p className="mb-2 mt-1 text-sm font-normal text-slate-400">
                  Send an email on every response these surveys get:
                </p>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center">
                    <Checkbox className="bg-white" id="any-survey" {...register("allSurveys")} />
                    <Label htmlFor="any-survey" className="ml-2 text-base font-normal">
                      All surveys (including new ones)
                    </Label>
                  </div>
                  <hr className="my-2" />
                  {surveys.map((survey) => (
                    <div key={survey.id} className="mb-1 flex items-center">
                      <Checkbox className="bg-white" id={survey.id} {...register(`surveys.${survey.id}`)} />
                      <Label htmlFor={survey.id} className="ml-2 text-base font-normal">
                        {survey.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Recipients</Label>
                {fields.map((item, index) => (
                  <div key={item.id} className="my-2 flex">
                    <Input
                      type="email"
                      {...register(`emails.${index}.email`, { required: true })}
                      placeholder="bob@company.com"
                      aria-placeholder="example email"
                    />
                    <Button variant="minimal" className="px-2" onClick={() => remove(index)}>
                      <TrashIcon className="h-4 w-4 text-slate-500" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() => append({ email: "" })}
                  variant="minimal"
                  EndIcon={PlusIcon}
                  endIconClassName="p-0.5"
                  className="px-2">
                  Add email
                </Button>
              </div>
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
              <Button variant="darkCTA" type="submit">
                Create alert
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
