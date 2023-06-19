"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { Badge, Button, ErrorComponent, Switch } from "@formbricks/ui";
import { QuestionMarkCircleIcon, TagIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import AttributeDetailModal from "./AttributeDetailModal";
import UploadAttributesModal from "./UploadAttributesModal";
import { timeSinceConditionally } from "@formbricks/lib/time";
import { useMemo } from "react";

export default function AttributeClassesList({ environmentId }: { environmentId: string }) {
  const { attributeClasses, isLoadingAttributeClasses, isErrorAttributeClasses } =
    useAttributeClasses(environmentId);

  const [isAttributeDetailModalOpen, setAttributeDetailModalOpen] = useState(false);
  const [isUploadCSVModalOpen, setUploadCSVModalOpen] = useState(false);
  const [activeAttributeClass, setActiveAttributeClass] = useState("" as any);
  const [showArchived, setShowArchived] = useState(false);

  const displayedAttributeClasses = useMemo(() => {
    return attributeClasses
      ? showArchived
        ? attributeClasses
        : attributeClasses.filter((ac) => !ac.archived)
      : [];
  }, [showArchived, attributeClasses]);

  const hasArchived = useMemo(() => {
    return attributeClasses ? attributeClasses.some((ac) => ac.archived) : false;
  }, [attributeClasses]);

  if (isLoadingAttributeClasses) {
    return <LoadingSpinner />;
  }
  if (isErrorAttributeClasses) {
    return <ErrorComponent />;
  }

  const handleOpenAttributeDetailModalClick = (e, attributeClass) => {
    e.preventDefault();
    setActiveAttributeClass(attributeClass);
    setAttributeDetailModalOpen(true);
  };

  const toggleShowArchived = () => {
    setShowArchived(!showArchived);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-end text-right">
        {hasArchived && (
          <div className="flex items-center text-sm font-medium">
            Show archived
            <Switch className="mx-3" checked={showArchived} onCheckedChange={toggleShowArchived} />
          </div>
        )}
        <Button
          variant="secondary"
          href="http://formbricks.com/docs/attributes/custom-attributes"
          target="_blank">
          <QuestionMarkCircleIcon className="mr-2 h-4 w-4" />
          How to add attributes
        </Button>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-5 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-3 pl-6 ">Name</div>
          <div className="text-center">Created</div>
          <div className="text-center">Last Updated</div>
        </div>
        <div className="grid-cols-7">
          {displayedAttributeClasses.map((attributeClass) => (
            <button
              onClick={(e) => {
                handleOpenAttributeDetailModalClick(e, attributeClass);
              }}
              className="w-full"
              key={attributeClass.id}>
              <div className="m-2 grid h-16  grid-cols-5 content-center rounded-lg hover:bg-slate-100">
                <div className="col-span-3 flex items-center pl-6 text-sm">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                      <TagIcon className="h-8 w-8 flex-shrink-0 text-slate-500" />
                    </div>
                    <div className="ml-4 text-left">
                      <div className="font-medium text-slate-900">
                        {attributeClass.name}
                        <span className="ml-2">
                          {attributeClass.archived && <Badge text="Archived" type="gray" size="tiny" />}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">{attributeClass.description}</div>
                    </div>
                  </div>
                </div>

                <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  <div className="text-slate-900">
                    {timeSinceConditionally(attributeClass.createdAt.toString())}
                  </div>
                </div>
                <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  <div className="text-slate-900">
                    {timeSinceConditionally(attributeClass.updatedAt.toString())}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <AttributeDetailModal
          environmentId={environmentId}
          open={isAttributeDetailModalOpen}
          setOpen={setAttributeDetailModalOpen}
          attributeClass={activeAttributeClass}
        />
        <UploadAttributesModal open={isUploadCSVModalOpen} setOpen={setUploadCSVModalOpen} />
      </div>
    </>
  );
}
