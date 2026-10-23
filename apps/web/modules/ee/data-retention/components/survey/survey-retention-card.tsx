"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { HourglassIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { useSurveyRetention } from "../../hooks/use-survey-retention";
import { formatRetentionDate, getSurveyRetentionLines } from "../../lib/display";
import type { TSurveyDataRetentionContext } from "../../types";
import { AddExemptionDialog } from "../exemptions/add-exemption-dialog";
import { DataRetentionQueryClientProvider } from "../query-client-provider";

interface SurveyRetentionCardProps {
  surveyId: string;
  surveyName: string;
  context: NonNullable<TSurveyDataRetentionContext>;
}

const SurveyRetentionCardContent = ({
  surveyId,
  surveyName,
  context,
}: Readonly<SurveyRetentionCardProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [open, setOpen] = useState(false);
  const [isExemptOpen, setIsExemptOpen] = useState(false);
  const { data: retention, isLoading } = useSurveyRetention({ surveyId });

  // Nothing to say, and no card, for a survey no active policy reaches.
  if (!isLoading && !retention?.governed) return null;

  const lines = retention
    ? getSurveyRetentionLines(retention, t, (iso) => formatRetentionDate(iso, locale, context.timeZone))
    : [];

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <button type="button" className="inline-flex px-4 py-4 text-left">
          <div className="flex items-center pr-5 pl-2">
            <HourglassIcon
              strokeWidth={2.5}
              className="size-7 rounded-full border border-slate-300 bg-slate-100 p-1.5 text-slate-600"
              aria-hidden
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("workspace.settings.data_retention.title")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("workspace.settings.data_retention.survey_card_description")}
            </p>
          </div>
        </button>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent
        className={`flex flex-col ${open ? "pb-3" : ""} overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down`}>
        <hr className="py-1 text-slate-600" />
        <div className="space-y-3 px-4 pb-1">
          {isLoading ? (
            <LoadingSpinner className="size-4" />
          ) : (
            <ul className="space-y-1 text-sm text-slate-700">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {context.canExempt ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsExemptOpen(true)}>
                {t("workspace.settings.data_retention.exempt_this_survey")}
              </Button>
            ) : null}
            <Link
              href={organizationSettingsPath(context.organizationId, "data-retention/policies")}
              className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline">
              {t("workspace.settings.data_retention.view_policies")}
            </Link>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
      {context.canExempt ? (
        <AddExemptionDialog
          organizationId={context.organizationId}
          timeZone={context.timeZone}
          open={isExemptOpen}
          onOpenChange={setIsExemptOpen}
          survey={{ id: surveyId, name: surveyName, workspaceName: "" }}
        />
      ) : null}
    </Collapsible.Root>
  );
};

/**
 * The survey editor's read-only Data retention card (ENG-3610): one line per active policy with its next
 * date, a link to the policies, and "Exempt this survey" for owners and managers. Reuses the editor's
 * collapsible settings-card pattern; no per-survey inputs.
 */
export const SurveyRetentionCard = (props: Readonly<SurveyRetentionCardProps>) => (
  <DataRetentionQueryClientProvider>
    <SurveyRetentionCardContent {...props} />
  </DataRetentionQueryClientProvider>
);
