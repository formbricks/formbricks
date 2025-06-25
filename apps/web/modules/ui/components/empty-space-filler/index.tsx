"use client";

import { Skeleton } from "@/modules/ui/components/skeleton";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { TEnvironment } from "@formbricks/types/environment";

type EmptySpaceFillerProps = {
  type: "table" | "response" | "event" | "linkResponse" | "tag" | "summary";
  environment: TEnvironment;
  noWidgetRequired?: boolean;
  emptyMessage?: string;
};

export const EmptySpaceFiller = ({
  type,
  environment,
  noWidgetRequired,
  emptyMessage,
}: EmptySpaceFillerProps) => {
  const { t } = useTranslate();
  if (type === "table") {
    return (
      <div className="shadow-xs group rounded-xl border border-slate-100 bg-white p-4">
        <div className="w-full space-y-3">
          <div className="h-16 w-full rounded-lg bg-slate-50"></div>
          <div className="flex h-16 w-full flex-col items-center justify-center rounded-lg bg-slate-50 text-slate-700 transition-all duration-300 ease-in-out hover:bg-slate-100">
            {!environment.appSetupCompleted && !noWidgetRequired && (
              <Link
                className="flex w-full items-center justify-center"
                href={`/environments/${environment.id}/project/app-connection`}>
                <span className="decoration-brand-dark underline transition-all duration-300 ease-in-out">
                  {t("environments.surveys.summary.install_widget")}{" "}
                  <strong>{t("environments.surveys.summary.go_to_setup_checklist")} </strong>
                </span>
              </Link>
            )}
            {((environment.appSetupCompleted || noWidgetRequired) && emptyMessage) ||
              t("environments.surveys.summary.waiting_for_response")}
          </div>

          <div className="h-16 w-full rounded-lg bg-slate-50"></div>
        </div>
      </div>
    );
  }

  if (type === "response") {
    return (
      <div className="group space-y-4 rounded-lg bg-white p-6">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-slate-100"></div>
          <div className="h-6 w-full rounded-full bg-slate-100"></div>
        </div>
        <div className="space-y-4">
          <div className="h-12 w-full rounded-full bg-slate-100"></div>
          <div className="flex h-12 w-full items-center justify-center rounded-full bg-slate-50 text-sm text-slate-500 hover:bg-slate-100">
            {!environment.appSetupCompleted && !noWidgetRequired && (
              <Link
                className="flex h-full w-full items-center justify-center"
                href={`/environments/${environment.id}/project/app-connection`}>
                <span className="decoration-brand-dark underline transition-all duration-300 ease-in-out">
                  {t("environments.surveys.summary.install_widget")}{" "}
                  <strong>{t("environments.surveys.summary.go_to_setup_checklist")} </strong>
                </span>
              </Link>
            )}
            {(environment.appSetupCompleted || noWidgetRequired) && (
              <span className="bg-light-background-primary-500 text-center">
                {emptyMessage ?? t("environments.surveys.summary.waiting_for_response")}
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
      <div className="group space-y-4 rounded-lg bg-white p-6">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-slate-100"></div>
          <div className="h-6 w-full rounded-full bg-slate-100"></div>
        </div>
        <div className="space-y-4">
          <div className="h-12 w-full rounded-full bg-slate-100"></div>
          <div className="flex h-12 w-full items-center justify-center rounded-full bg-slate-50 text-sm text-slate-500 hover:bg-slate-100">
            {!environment.appSetupCompleted && !noWidgetRequired && (
              <Link
                className="flex h-full w-full items-center justify-center"
                href={`/environments/${environment.id}/project/app-connection`}>
                <span className="decoration-brand-dark underline transition-all duration-300 ease-in-out">
                  {t("environments.surveys.summary.install_widget")}{" "}
                  <strong>{t("environments.surveys.summary.go_to_setup_checklist")} 👉</strong>
                </span>
              </Link>
            )}
            {(environment.appSetupCompleted || noWidgetRequired) && (
              <span className="text-center">{t("environments.project.tags.empty_message")}</span>
            )}
          </div>
          <div className="h-12 w-full rounded-full bg-slate-50/50"></div>
        </div>
      </div>
    );
  }

  if (type === "summary") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Skeleton className="group space-y-4 rounded-lg bg-white p-6">
          <div className="flex items-center space-x-4">
            <div className="h-6 w-full rounded-full bg-slate-100"></div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="h-6 w-24 rounded-full bg-slate-100"></div>
              <div className="h-6 w-24 rounded-full bg-slate-100"></div>
            </div>
            <div className="flex h-12 w-full items-center justify-center rounded-full bg-slate-50 text-sm text-slate-500 hover:bg-slate-100"></div>
            <div className="h-12 w-full rounded-full bg-slate-50/50"></div>
          </div>
        </Skeleton>
      </div>
    );
  }

  return (
    <div className="group space-y-4 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 flex-shrink-0 rounded-full bg-slate-100"></div>
        <div className="h-6 w-full rounded-full bg-slate-100"></div>
      </div>
      <div className="space-y-4">
        <div className="h-12 w-full rounded-full bg-slate-100"></div>
        <div className="flex h-12 w-full items-center justify-center rounded-full bg-slate-50 text-sm text-slate-500 hover:bg-slate-100">
          {!environment.appSetupCompleted && !noWidgetRequired && (
            <Link
              className="flex h-full w-full items-center justify-center"
              href={`/environments/${environment.id}/project/app-connection`}>
              <span className="decoration-brand-dark underline transition-all duration-300 ease-in-out">
                {t("environments.surveys.summary.install_widget")}{" "}
                <strong>{t("environments.surveys.summary.go_to_setup_checklist")} 👉</strong>
              </span>
            </Link>
          )}
          {(environment.appSetupCompleted || noWidgetRequired) && (
            <span className="text-center">{t("environments.surveys.summary.waiting_for_response")}</span>
          )}
        </div>
        <div className="h-12 w-full rounded-full bg-slate-50/50"></div>
      </div>
    </div>
  );
};
