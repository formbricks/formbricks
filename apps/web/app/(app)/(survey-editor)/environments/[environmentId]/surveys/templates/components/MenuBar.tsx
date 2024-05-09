"use client";

import { BackButton } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/templates/components/BackButton";

export const MenuBar = () => {
  return (
    <>
      <div className="border-b border-slate-200 bg-white px-5 py-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2 whitespace-nowrap">
          <BackButton />
        </div>
      </div>
    </>
  );
};
