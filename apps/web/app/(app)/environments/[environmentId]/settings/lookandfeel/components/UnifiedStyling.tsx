"use client";

import React from "react";

import { Switch } from "@formbricks/ui/Switch";

const UnifiedStyling = () => {
  return (
    <div className="flex">
      {/* Styling settings */}
      <div className="w-1/2 pr-6">
        <div className="flex flex-col">
          <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-6">
              <Switch />
              <div className="flex flex-col">
                <h3 className="text-base font-semibold">Enable unified styling</h3>
                <p className="text-sm text-slate-500">Set base styles for all surveys below</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <Switch />
              <div className="flex flex-col">
                <h3 className="text-base font-semibold">Allow overwriting styles</h3>
                <p className="text-sm text-slate-500">
                  Activate if you want some surveys to be styled differently
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Survey Preview */}

      <div className="w-1/2 bg-slate-100">
        <h1>Survey Preview</h1>
      </div>
    </div>
  );
};

export default UnifiedStyling;
