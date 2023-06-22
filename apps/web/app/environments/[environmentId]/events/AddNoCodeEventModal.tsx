"use client";

import Modal from "@/components/shared/Modal";
import { createEventClass } from "@/lib/eventClasses/eventClasses";
import type { Event, NoCodeConfig } from "@formbricks/types/events";
import {
  Button,
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
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { testURLmatch } from "./testURLmatch";

interface EventDetailModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  mutateEventClasses: (data?: any) => void;
}

export default function AddNoCodeEventModal({
  environmentId,
  open,
  setOpen,
  mutateEventClasses,
}: EventDetailModalProps) {
  const { register, control, handleSubmit, watch, reset } = useForm();

  // clean up noCodeConfig before submitting by removing unnecessary fields
  const filterNoCodeConfig = (noCodeConfig: NoCodeConfig): NoCodeConfig => {
    const { type } = noCodeConfig;
    return {
      type,
      [type]: noCodeConfig[type],
    };
  };

  const submitEventClass = async (data: Partial<Event>): Promise<void> => {
    const filteredNoCodeConfig = filterNoCodeConfig(data.noCodeConfig as NoCodeConfig);

    const updatedData: Event = {
      ...data,
      noCodeConfig: filteredNoCodeConfig,
      type: "noCode",
    } as Event;

    try {
      await createEventClass(environmentId, updatedData);
      mutateEventClasses();
      reset();
      setOpen(false);
      toast.success("Action added successfully.");
    } catch (e) {
      toast.error(e.message);
      return;
    }
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

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <CursorArrowRaysIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Add Action</div>
                <div className="text-sm text-slate-500">
                  Track a user action to display surveys when it&apos;s performed.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitEventClass)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <Label>Select By</Label>
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
              </div>
              <div className="grid w-full grid-cols-2 gap-x-8">
                <div className="col-span-1">
                  <Label>Name</Label>
                  <Input placeholder="e.g. Dashboard Page View" {...register("name", { required: true })} />
                </div>
                <div className="col-span-1">
                  <Label>Description</Label>
                  <Input placeholder="e.g. User visited dashboard" {...register("description")} />
                </div>
              </div>
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
                Add Action
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
