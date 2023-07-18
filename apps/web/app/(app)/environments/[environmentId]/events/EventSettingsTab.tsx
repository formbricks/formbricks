import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { deleteEventClass, useEventClass, useEventClasses } from "@/lib/eventClasses/eventClasses";
import { useEventClassMutation } from "@/lib/eventClasses/mutateEventClasses";
import type { Event, NoCodeConfig } from "@formbricks/types/events";
import {
  Button,
  ErrorComponent,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { testURLmatch } from "./testURLmatch";

interface EventSettingsTabProps {
  environmentId: string;
  eventClassId: string;
  setOpen: (v: boolean) => void;
}

export default function EventSettingsTab({ environmentId, eventClassId, setOpen }: EventSettingsTabProps) {
  const { eventClass, isLoadingEventClass, isErrorEventClass } = useEventClass(environmentId, eventClassId);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const { register, handleSubmit, control, watch } = useForm({
    defaultValues: {
      name: eventClass.name,
      description: eventClass.description,
      noCodeConfig: eventClass.noCodeConfig,
    },
  });
  const { triggerEventClassMutate, isMutatingEventClass } = useEventClassMutation(
    environmentId,
    eventClass.id
  );

  const { mutateEventClasses } = useEventClasses(environmentId);

  const onSubmit = async (data) => {
    const filteredNoCodeConfig = filterNoCodeConfig(data.noCodeConfig as NoCodeConfig);

    const updatedData: Event = {
      ...data,
      noCodeConfig: filteredNoCodeConfig,
      type: "noCode",
    } as Event;

    await triggerEventClassMutate(updatedData);
    mutateEventClasses();
    setOpen(false);
  };

  const filterNoCodeConfig = (noCodeConfig: NoCodeConfig): NoCodeConfig => {
    const { type } = noCodeConfig;
    return {
      type,
      [type]: noCodeConfig[type],
    };
  };

  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");

  const handleMatchClick = () => {
    const match = testURLmatch(
      testUrl,
      watch("noCodeConfig.[pageUrl].value"),
      watch("noCodeConfig.[pageUrl].rule")
    );
    setIsMatch(match);
    if (match === "yes") toast.success("Your survey would be shown on this URL.");
    if (match === "no") toast.error("Your survey would not be shown.");
  };

  if (isLoadingEventClass) return <LoadingSpinner />;
  if (isErrorEventClass) return <ErrorComponent />;

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="">
          <Label className="text-slate-600">Display name</Label>
          <Input
            type="text"
            placeholder="e.g. Product Team Info"
            {...register("name", {
              value: eventClass.name,
              disabled: eventClass.type === "automatic" || eventClass.type === "code" ? true : false,
            })}
          />
        </div>
        <div className="">
          <Label className="text-slate-600">Display description</Label>
          <Input
            type="text"
            placeholder="e.g. Triggers when user changed subscription"
            {...register("description", {
              value: eventClass.description,
              disabled: eventClass.type === "automatic" ? true : false,
            })}
          />
        </div>
        <div className="">
          <Label>Action Type</Label>
          {eventClass.type === "code" ? (
            <p className="text-sm text-slate-600">
              This is a code action. Please make changes in your code base.
            </p>
          ) : eventClass.type === "noCode" ? (
            <div className="flex justify-between rounded-lg">
              <div className="w-full space-y-4">
                <Controller
                  name="noCodeConfig.type"
                  defaultValue={"pageUrl"}
                  control={control}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <RadioGroup className="flex" onValueChange={onChange} onBlur={onBlur} value={value}>
                      <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
                        <RadioGroupItem value="pageUrl" id="pageUrl" className="bg-slate-50" />
                        <Label htmlFor="pageUrl" className="flex cursor-pointer items-center">
                          Page URL
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
                        <RadioGroupItem value="innerHtml" id="innerHtml" className="bg-slate-50" />
                        <Label htmlFor="innerHtml" className="flex cursor-pointer items-center">
                          Inner Text
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
                        <RadioGroupItem value="cssSelector" id="cssSelector" className="bg-slate-50" />
                        <Label htmlFor="cssSelector" className="flex cursor-pointer items-center">
                          CSS Selector
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
                {(watch("noCodeConfig.type") === "pageUrl" || !watch("noCodeConfig.type")) && (
                  <>
                    <div className="grid w-full grid-cols-3 gap-x-8">
                      <div className="col-span-1">
                        <Label>URL</Label>
                        <Controller
                          name="noCodeConfig.pageUrl.rule"
                          defaultValue={"exactMatch"}
                          control={control}
                          render={({ field }) => (
                            <Select
                              onValueChange={field.onChange}
                              /* onValueChange={(e) => {
                            setMatchType(e as MatchType);
                            setIsMatch("default");
                          }} */
                              {...field}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select match type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="exactMatch">Exactly matches</SelectItem>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="startsWith">Starts with</SelectItem>
                                <SelectItem value="endsWith">Ends with</SelectItem>
                                <SelectItem value="notMatch">Does not exactly match</SelectItem>
                                <SelectItem value="notContains">Does not contain</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="col-span-2 flex w-full items-end">
                        <Input
                          type="text"
                          placeholder="e.g. https://app.formbricks.com/dashboard"
                          {...register("noCodeConfig.[pageUrl].value", { required: true })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Test Your URL</Label>
                      <div className=" rounded bg-slate-50 p-4">
                        <Label className="font-normal text-slate-500">
                          Enter a URL to see if it matches your event URL
                        </Label>
                        <div className="mt-1 flex">
                          <Input
                            type="text"
                            value={testUrl}
                            onChange={(e) => {
                              setTestUrl(e.target.value);
                              setIsMatch("default");
                            }}
                            className={clsx(
                              isMatch === "yes"
                                ? "border-green-500 bg-green-50"
                                : isMatch === "no"
                                ? "border-red-200 bg-red-50"
                                : isMatch === "default"
                                ? "border-slate-200 bg-white"
                                : null
                            )}
                            placeholder="Paste the URL you want the event to trigger on"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            className="ml-2 whitespace-nowrap"
                            onClick={() => {
                              handleMatchClick();
                            }}>
                            Test Match
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {watch("noCodeConfig.type") === "innerHtml" && (
                  <div className="grid w-full grid-cols-3 gap-x-8">
                    <div className="col-span-1">
                      <Label>Inner Text</Label>
                    </div>
                    <div className="col-span-3 flex w-full items-end">
                      <Input
                        type="text"
                        placeholder="e.g. 'Install App'"
                        {...register("noCodeConfig.innerHtml.value", { required: true })}
                      />
                    </div>
                  </div>
                )}
                {watch("noCodeConfig.type") === "cssSelector" && (
                  <div className="grid w-full grid-cols-3 gap-x-8">
                    <div className="col-span-1">
                      <Label>CSS Tag</Label>
                    </div>
                    <div className="col-span-3 flex w-full items-end">
                      <Input
                        type="text"
                        placeholder="e.g. #install-button"
                        {...register("noCodeConfig.cssSelector.value", { required: true })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : eventClass.type === "automatic" ? (
            <p className="text-sm text-slate-600">
              This action was created automatically. You cannot make changes to it.
            </p>
          ) : null}
        </div>
        <div className="flex justify-between border-t border-slate-200 py-6">
          <div>
            {eventClass.type !== "automatic" && (
              <Button
                type="button"
                variant="warn"
                onClick={() => setOpenDeleteDialog(true)}
                StartIcon={TrashIcon}
                className="mr-3">
                Delete
              </Button>
            )}

            <Button variant="secondary" href="https://formbricks.com/docs" target="_blank">
              Read Docs
            </Button>
          </div>
          {eventClass.type !== "automatic" && (
            <div className="flex space-x-2">
              <Button type="submit" variant="darkCTA" loading={isMutatingEventClass}>
                Save changes
              </Button>
            </div>
          )}
        </div>
      </form>
      <DeleteDialog
        open={openDeleteDialog}
        setOpen={setOpenDeleteDialog}
        deleteWhat={"Action"}
        text="Are you sure you want to delete this action? This also removes this action as a trigger from all your surveys."
        onDelete={async () => {
          setOpen(false);
          try {
            await deleteEventClass(environmentId, eventClass.id);
            mutateEventClasses();
            toast.success("Action deleted successfully");
          } catch (error) {
            toast.error("Something went wrong. Please try again.");
          }
        }}
      />
    </div>
  );
}
