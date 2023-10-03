"use client";

import React from "react";
import Link from "next/link";
import { TEnvironment } from "@formbricks/types/v1/environment";

type EmptySpaceFillerProps = {
  type: "table" | "response" | "event" | "linkResponse" | "tag";
  environment: TEnvironment;
  noWidgetRequired?: boolean;
  emptyMessage?: string;
};

const EmptySpaceFiller: React.FC<EmptySpaceFillerProps> = ({
  type,
  environment,
  noWidgetRequired,
  emptyMessage,
}) => {
  if (type === "table") {
    return (
      <div className="group">
        <div className="h-12 w-full rounded-t-lg bg-slate-100"></div>
        <div className="w-full space-y-4 rounded-b-lg bg-white p-4">
          <div className="h-16 w-full rounded-lg bg-slate-100"></div>

          <div className="flex h-16 w-full flex-col items-center justify-center rounded-lg bg-slate-50 text-slate-700 transition-all duration-300 ease-in-out hover:bg-slate-100 ">
            {!environment.widgetSetupCompleted && !noWidgetRequired && (
              <Link
                className="flex w-full items-center justify-center"
                href={`/environments/${environment.id}/settings/setup`}>
                <span className="decoration-brand-dark underline  transition-all duration-300  ease-in-out">
                  Install Formbricks Widget. <strong>Go to Setup Checklist 👉</strong>
                </span>
              </Link>
            )}
            {((environment.widgetSetupCompleted || noWidgetRequired) && emptyMessage) ||
              "Your data will appear here as soon as you receive your first response ⏲️"}
          </div>

          <div className="h-16 w-full rounded-lg bg-slate-50/50"></div>
        </div>
      </div>
    );
  }

  if (type === "response") {
    return (
      <div className="group space-y-4 rounded-lg bg-white p-6 ">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-slate-100"></div>
          <div className=" h-6 w-full rounded-full bg-slate-100"></div>
        </div>
        <div className="space-y-4">
          <div className="h-12 w-full rounded-full bg-slate-100"></div>
          <div className=" flex h-12 w-full items-center justify-center rounded-full bg-slate-50 text-sm text-slate-500 hover:bg-slate-100">
            {!environment.widgetSetupCompleted && !noWidgetRequired && (
              <Link
                className="flex h-full w-full items-center justify-center"
                href={`/environments/${environment.id}/settings/setup`}>
                <span className="decoration-brand-dark underline  transition-all duration-300 ease-in-out">
                  Install Formbricks Widget. <strong>Go to Setup Checklist 👉</strong>
                </span>
              </Link>
            )}
            {(environment.widgetSetupCompleted || noWidgetRequired) && (
              <span className="text-center">
                Your data will appear here as soon as you receive your first response ⏲️
              </span>
            )}
          </div>
          <div className="h-12 w-full rounded-full bg-slate-50/50"></div>
        </div>
      </div>
    );
  }

  if (type === "tag") {
    return (
      <div className="group space-y-4 rounded-lg bg-white p-6 ">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-slate-100"></div>
          <div className=" h-6 w-full rounded-full bg-slate-100"></div>
        </div>
        <div className="space-y-4">
          <div className="h-12 w-full rounded-full bg-slate-100"></div>
          <div className=" flex h-12 w-full items-center justify-center rounded-full bg-slate-50 text-sm text-slate-500 hover:bg-slate-100">
            {!environment.widgetSetupCompleted && !noWidgetRequired && (
              <Link
                className="flex h-full w-full items-center justify-center"
                href={`/environments/${environment.id}/settings/setup`}>
                <span className="decoration-brand-dark underline  transition-all duration-300 ease-in-out">
                  Install Formbricks Widget. <strong>Go to Setup Checklist 👉</strong>
                </span>
              </Link>
            )}
            {(environment.widgetSetupCompleted || noWidgetRequired) && (
              <span className="text-center">Tag a submission to find your list of tags here.</span>
            )}
          </div>
          <div className="h-12 w-full rounded-full bg-slate-50/50"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="group space-y-4 rounded-lg bg-white p-6 ">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 flex-shrink-0 rounded-full bg-slate-100"></div>
        <div className=" h-6 w-full rounded-full bg-slate-100"></div>
      </div>
      <div className="space-y-4">
        <div className="h-12 w-full rounded-full bg-slate-100"></div>
        <div className=" flex h-12 w-full items-center justify-center rounded-full bg-slate-50 text-sm text-slate-500 hover:bg-slate-100">
          {!environment.widgetSetupCompleted && !noWidgetRequired && (
            <Link
              className="flex h-full w-full items-center justify-center"
              href={`/environments/${environment.id}/settings/setup`}>
              <span className="decoration-brand-dark underline  transition-all duration-300 ease-in-out">
                Install Formbricks Widget. <strong>Go to Setup Checklist 👉</strong>
              </span>
            </Link>
          )}
          {(environment.widgetSetupCompleted || noWidgetRequired) && (
            <span className="text-center">
              Your data will appear here as soon as you receive your first response ⏲️
            </span>
          )}
        </div>
        <div className="h-12 w-full rounded-full bg-slate-50/50"></div>
      </div>
    </div>
  );
};

export default EmptySpaceFiller;
