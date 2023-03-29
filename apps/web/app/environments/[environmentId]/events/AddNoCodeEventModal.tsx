"use client";

import Modal from "@/components/shared/Modal";
import { Button } from "@formbricks/ui";
import { Input } from "@formbricks/ui";
import { Label } from "@formbricks/ui";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui";
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { testURLmatch } from "./testURLmatch";
import clsx from "clsx";
import { useForm, Controller } from "react-hook-form";
import { createEventClass } from "@/lib/eventClasses/eventClasses";

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
  const { register, control, handleSubmit, watch } = useForm();

  const submitEventClass = async (data) => {
    await createEventClass(environmentId, { ...data, type: "noCode" });
    mutateEventClasses();
    setOpen(false);
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
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <CursorArrowRaysIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Add No-Code Event</div>
                <div className="text-sm text-slate-500">
                  Create a new no-code event to filter your user base with.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitEventClass)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <Label>Select By</Label>
                <Controller
                  name="noCodeConfig.type"
                  defaultValue={"pageUrl"}
                  control={control}
                  render={({ field }) => (
                    <RadioGroup className="flex" {...field}>
                      <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
                        <RadioGroupItem value="pageUrl" id="pageUrl" className="bg-slate-50" />
                        <Label htmlFor="pageUrl" className="flex cursor-pointer items-center">
                          Page URL
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg bg-slate-50 p-3">
                        <RadioGroupItem disabled value="innerHtml" id="innerHtml" className="bg-slate-50" />
                        <Label
                          htmlFor="innerHtml"
                          className="flex cursor-not-allowed items-center text-slate-500">
                          Inner Text
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg bg-slate-50 p-3">
                        <RadioGroupItem
                          disabled
                          value="cssSelector"
                          id="cssSelector"
                          className="bg-slate-50"
                        />
                        <Label
                          htmlFor="cssSelector"
                          className="flex cursor-not-allowed items-center text-slate-500">
                          CSS Selector
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-x-2">
                <div>
                  <Label>Name</Label>
                  <Input placeholder="e.g. Dashboard Page View" {...register("name", { required: true })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input placeholder="e.g. User visited dashboard" {...register("description")} />
                </div>
              </div>
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
              <Button variant="primary" type="submit">
                Add event
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
