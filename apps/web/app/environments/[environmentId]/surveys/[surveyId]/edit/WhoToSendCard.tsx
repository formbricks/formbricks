"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { cn } from "@formbricks/lib/cn";
import type { Survey } from "@formbricks/types/surveys";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui";
import { CheckCircleIcon, InformationCircleIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useEffect, useState } from "react";

const filterConditions = [
  { id: "equals", name: "equals" },
  { id: "notEquals", name: "not equals" },
];

interface WhoToSendCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
}

export default function WhoToSendCard({ environmentId, localSurvey, setLocalSurvey }: WhoToSendCardProps) {
  const [open, setOpen] = useState(false);
  const { attributeClasses, isLoadingAttributeClasses, isErrorAttributeClasses } =
    useAttributeClasses(environmentId);

  useEffect(() => {
    if (!isLoadingAttributeClasses) {
      if (attributeClasses.length > 0) {
        setOpen(true);
      }
    }
  }, [isLoadingAttributeClasses]);

  const addAttributeFilter = () => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.attributeFilters = [
      ...localSurvey.attributeFilters,
      { attributeClassId: "", condition: filterConditions[0].id, value: "" },
    ];
    setLocalSurvey(updatedSurvey);
  };

  const setAttributeFilter = (idx: number, attributeClassId: string, condition: string, value: string) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.attributeFilters[idx] = { attributeClassId, condition, value };
    setLocalSurvey(updatedSurvey);
  };

  const removeAttributeFilter = (idx: number) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.attributeFilters = [
      ...localSurvey.attributeFilters.slice(0, idx),
      ...localSurvey.attributeFilters.slice(idx + 1),
    ];
    setLocalSurvey(updatedSurvey);
  };

  if (isLoadingAttributeClasses) {
    return <LoadingSpinner />;
  }

  if (isErrorAttributeClasses) {
    return <div>Error</div>;
  }

  if (localSurvey.type === "link") {
    return null;
  }

  return (
    <>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className={cn(
          open ? "" : "hover:bg-slate-50",
          "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
        )}>
        <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
          <div className="inline-flex px-4 py-6">
            <div className="flex items-center pl-2 pr-5">
              <CheckCircleIcon className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Who to ask</p>
              <p className="mt-1 truncate text-sm text-slate-500">
                Choose the actions which attributeFilter the survey.
              </p>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="">
          <hr className="py-1 text-slate-600" />
          {localSurvey.attributeFilters.length === 0 && (
            <div className="px-4 pb-0 pt-4">
              <Alert>
                <InformationCircleIcon className="h-4 w-4" />
                <AlertTitle>Survey all people</AlertTitle>
                <AlertDescription>
                  If no additional filters are selected, all users can potentially be surveyed.
                </AlertDescription>
              </Alert>
            </div>
          )}
          {localSurvey.attributeFilters.map((attributeFilter, idx) => (
            <div className="mt-2 px-5" key={idx}>
              <div className="justify-left flex items-center space-x-3">
                <p className={cn(idx !== 0 && "ml-5", "text-right text-sm")}>{idx === 0 ? "Where" : "and"}</p>
                <Select
                  value={attributeFilter.attributeClassId}
                  onValueChange={(attributeClassId) =>
                    setAttributeFilter(
                      idx,
                      attributeClassId,
                      attributeFilter.condition,
                      attributeFilter.value
                    )
                  }>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {attributeClasses.map((attributeClass) => (
                      <SelectItem value={attributeClass.id}>{attributeClass.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={attributeFilter.condition}
                  onValueChange={(condition) =>
                    setAttributeFilter(
                      idx,
                      attributeFilter.attributeClassId,
                      condition,
                      attributeFilter.value
                    )
                  }>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filterConditions.map((filterCondition) => (
                      <SelectItem value={filterCondition.id}>{filterCondition.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={attributeFilter.value}
                  onChange={(e) =>
                    setAttributeFilter(
                      idx,
                      attributeFilter.attributeClassId,
                      attributeFilter.condition,
                      e.target.value
                    )
                  }
                />
                <button onClick={() => removeAttributeFilter(idx)}>
                  <TrashIcon className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
          ))}
          <div className="ml-14 px-8 py-4">
            <Button
              variant="secondary"
              onClick={() => {
                addAttributeFilter();
              }}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add filter
            </Button>
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </>
  );
}
