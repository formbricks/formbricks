"use client";

import React from "react";
import Link from "next/link";

type EmptySpaceFillerProps = {
  type: "table" | "response" | "event";
  environmentId?: string;
};

const EmptySpaceFiller: React.FC<EmptySpaceFillerProps> = ({ type, environmentId }) => {
  if (type === "table") {
    return (
      <div className="group">
        <div className="h-12 w-full rounded-t-lg bg-slate-100"></div>
        <div className="w-full space-y-4 rounded-b-lg bg-white p-4">
          <div className="h-16 w-full rounded-lg bg-slate-100"></div>

          <div className="decoration-brand-dark flex h-16 w-full items-center justify-center rounded-lg bg-slate-50 text-slate-700 transition-all duration-300  ease-in-out hover:underline ">
            <Link
              className="flex h-full w-full items-center justify-center"
              href={`/environments/${environmentId}/settings/setup`}>
              <span className="opacity-0 transition-all duration-300  ease-in-out group-hover:opacity-100">
                No data yet. Setup Formbricks Widget to get started 🚀
              </span>
            </Link>
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
          <div className="h-12 w-12 rounded-full bg-slate-100"></div>
          <div className=" h-6 w-full rounded-full bg-slate-100"></div>
        </div>
        <div className="space-y-4">
          <div className="h-12 w-full rounded-full bg-slate-100"></div>
          <div className="decoration-brand-dark h-12 w-full rounded-full bg-slate-50 hover:underline">
            <Link
              className="flex h-full w-full items-center justify-center"
              href={`/environments/${environmentId}/settings/setup`}>
              <span className="opacity-0 transition-all duration-300  ease-in-out group-hover:opacity-100">
                No data yet. Setup Formbricks Widget to get started 🚀
              </span>
            </Link>
          </div>
          <div className="h-12 w-full rounded-full bg-slate-50/50"></div>
        </div>
      </div>
    );
  }
  if (type === "event") {
    return (
      <div className="group space-y-8 rounded-lg bg-white p-6 ">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-full bg-slate-100"></div>
          <div className=" h-6 w-full rounded-full bg-slate-100"></div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-full bg-slate-100"></div>
          <div className=" h-6 w-full rounded-full bg-slate-100"></div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-full bg-slate-100"></div>
          <div className=" h-6 w-full rounded-full bg-slate-100"></div>
        </div>
      </div>
    );
  }
  return null;
};

export default EmptySpaceFiller;
