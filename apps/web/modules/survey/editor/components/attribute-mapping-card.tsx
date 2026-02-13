"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Contact2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface AttributeMappingCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeElementId: string | null;
  setActiveElementId: (elementId: string | null) => void;
  contactAttributeKeys: TContactAttributeKey[];
}

export const AttributeMappingCard = ({
  activeElementId,
  localSurvey,
  setActiveElementId,
  setLocalSurvey,
  contactAttributeKeys,
}: AttributeMappingCardProps) => {
  const open = activeElementId === "attributeMapping";
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [selectedAttributeKey, setSelectedAttributeKey] = useState<string>("");
  const setOpen = (open: boolean) => {
    if (open) {
      setActiveElementId("attributeMapping");
    } else {
      setActiveElementId(null);
    }
  };

  const elements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);

  // Get eligible elements for pre-population (OpenText and FormField types)
  const eligibleElements = useMemo(() => {
    return elements.filter((element) => element.type === "openText" || element.type === "contactInfo");
  }, [elements]);

  const updateSurvey = (attributeMapping: Record<string, string>) => {
    setLocalSurvey({
      ...localSurvey,
      attributeMapping,
    });
  };

  const handleAddMapping = () => {
    if (!selectedQuestionId || !selectedAttributeKey) {
      toast.error("Please select both a question and an attribute");
      return;
    }

    // Check if this question already has a mapping
    if (localSurvey.attributeMapping?.[selectedQuestionId]) {
      toast.error("This question already has an attribute mapping");
      return;
    }

    const newMapping = {
      ...(localSurvey.attributeMapping || {}),
      [selectedQuestionId]: selectedAttributeKey,
    };

    updateSurvey(newMapping);
    toast.success("Attribute mapping added successfully");
    setSelectedQuestionId("");
    setSelectedAttributeKey("");
  };

  const handleDeleteMapping = (questionId: string) => {
    const newMapping = { ...localSurvey.attributeMapping };
    delete newMapping[questionId];
    updateSurvey(newMapping);
    toast.success("Attribute mapping removed");
  };

  // Auto Animate
  const [parent] = useAutoAnimate();

  const attributeMapping = localSurvey.attributeMapping || {};
  const mappingEntries = Object.entries(attributeMapping);

  return (
    <div className={cn(open ? "shadow-lg" : "shadow-md", "group z-10 flex flex-row rounded-lg bg-white")}>
      <div
        className={cn(
          open ? "bg-slate-50" : "bg-white group-hover:bg-slate-50",
          "flex w-10 items-center justify-center rounded-l-lg border-t border-b border-l group-aria-expanded:rounded-bl-none"
        )}>
        <Contact2 className="h-4 w-4" />
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between rounded-r-lg p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Contact Attribute Pre-population</p>
                {mappingEntries.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {mappingEntries.length} {mappingEntries.length === 1 ? "mapping" : "mappings"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className={`flex flex-col px-4 ${open && "pb-6"}`} ref={parent}>
          {/* Existing Mappings */}
          <div className="space-y-2" ref={parent}>
            {mappingEntries.length > 0 ? (
              mappingEntries.map(([questionId, attributeKey]) => {
                const element = elements.find((e) => e.id === questionId);
                const elementLabel = element?.headline?.default || element?.headline?.en || questionId;

                return (
                  <div
                    key={questionId}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{elementLabel}</p>
                      <p className="text-xs text-slate-500">
                        maps to: <span className="font-mono">{attributeKey}</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMapping(questionId)}
                      className="ml-2 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="mt-2 text-sm text-slate-500 italic">
                No attribute mappings yet. Add one below to pre-populate questions from contact attributes.
              </p>
            )}
          </div>

          {/* Add New Mapping Form */}
          {contactAttributeKeys.length > 0 && eligibleElements.length > 0 ? (
            <div className="mt-5 space-y-3">
              <div>
                <Label htmlFor="questionSelect">Question to Pre-populate</Label>
                <Select value={selectedQuestionId} onValueChange={setSelectedQuestionId}>
                  <SelectTrigger id="questionSelect" className="mt-2">
                    <SelectValue placeholder="Select a question..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleElements.map((element) => {
                      const label = element.headline?.default || element.headline?.en || element.id;
                      const isAlreadyMapped = !!attributeMapping[element.id];
                      return (
                        <SelectItem key={element.id} value={element.id} disabled={isAlreadyMapped}>
                          {label} {isAlreadyMapped ? "(already mapped)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="attributeSelect">Contact Attribute</Label>
                <Select value={selectedAttributeKey} onValueChange={setSelectedAttributeKey}>
                  <SelectTrigger id="attributeSelect" className="mt-2">
                    <SelectValue placeholder="Select an attribute..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contactAttributeKeys.map((attributeKey) => (
                      <SelectItem key={attributeKey.id} value={attributeKey.key}>
                        {attributeKey.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="secondary"
                onClick={handleAddMapping}
                disabled={!selectedQuestionId || !selectedAttributeKey}
                className="w-full">
                Add Mapping
              </Button>
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                {contactAttributeKeys.length === 0 &&
                  "No contact attributes available. Create contact attributes first."}
                {eligibleElements.length === 0 &&
                  contactAttributeKeys.length > 0 &&
                  "No eligible questions. Add text input or contact info questions to use attribute mapping."}
              </p>
            </div>
          )}
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
