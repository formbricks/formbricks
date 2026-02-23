"use client";

import { useTranslation } from "react-i18next";

const SKELETON_ROWS = 5;

const SkeletonRow = () => {
  return (
    <div className="grid h-12 w-full animate-pulse grid-cols-8 content-center p-2">
      <div className="col-span-3 flex items-center gap-4 pl-6">
        <div className="h-5 w-5 rounded bg-gray-200" />
        <div className="h-4 w-36 rounded bg-gray-200" />
      </div>
      <div className="col-span-1 my-auto hidden sm:flex sm:justify-center">
        <div className="h-4 w-6 rounded bg-gray-200" />
      </div>
      <div className="col-span-1 my-auto hidden sm:flex sm:justify-center">
        <div className="h-4 w-16 rounded bg-gray-200" />
      </div>
      <div className="col-span-1 my-auto hidden sm:flex sm:justify-center">
        <div className="h-4 w-24 rounded bg-gray-200" />
      </div>
      <div className="col-span-1 my-auto hidden sm:flex sm:justify-center">
        <div className="h-4 w-20 rounded bg-gray-200" />
      </div>
      <div className="col-span-1" />
    </div>
  );
};

export const DashboardsListSkeleton = () => {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-8 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">{t("common.title")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.charts")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created_by")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.updated")}</div>
        <div className="col-span-1" />
      </div>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
};
