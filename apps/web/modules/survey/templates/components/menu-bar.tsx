"use client";

import { BackButton } from "@/modules/survey/templates/components/back-button";

export const MenuBar = () => {
  return (
    <>
      <div className="border-b border-slate-200 bg-white px-5 py-2.5 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2 whitespace-nowrap">
          <BackButton path="/" />
        </div>
      </div>
    </>
  );
};
