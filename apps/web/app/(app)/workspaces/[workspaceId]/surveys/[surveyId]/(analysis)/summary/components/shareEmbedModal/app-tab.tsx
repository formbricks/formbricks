"use client";

import {
  CodeXmlIcon,
  MousePointerClickIcon,
  PercentIcon,
  Repeat1Icon,
  TimerResetIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TActionClass } from "@formbricks/types/action-classes";
import { TSegment } from "@formbricks/types/segment";
import { useWorkspaceContext } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { useSurvey } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/context/survey-context";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { H4, InlineSmall, Small } from "@/modules/ui/components/typography";
import { DocumentationLinksSection } from "./documentation-links-section";

const createDocumentationLinks = (t: ReturnType<typeof useTranslation>["t"]) => [
  {
    href: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#html",
    title: t("workspace.surveys.summary.in_app.html_embed"),
  },
  {
    href: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#react-js",
    title: t("workspace.surveys.summary.in_app.javascript_sdk"),
  },
  {
    href: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#swift",
    title: t("workspace.surveys.summary.in_app.ios_sdk"),
  },
  {
    href: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#android",
    title: t("workspace.surveys.summary.in_app.kotlin_sdk"),
  },
  {
    href: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#react-native",
    title: t("workspace.surveys.summary.in_app.react_native_sdk"),
  },
];

const createNoCodeConfigType = (t: ReturnType<typeof useTranslation>["t"]) => ({
  click: t("workspace.actions.click"),
  pageView: t("workspace.actions.page_view"),
  exitIntent: t("workspace.actions.exit_intent"),
  fiftyPercentScroll: t("workspace.actions.fifty_percent_scroll"),
  pageDwell: t("workspace.actions.time_on_page"),
});

const formatRecontactDaysString = (days: number, t: ReturnType<typeof useTranslation>["t"]) => {
  if (days === 0) {
    return t("workspace.surveys.summary.in_app.display_criteria.time_based_always");
  } else if (days === 1) {
    return `${days} ${t("workspace.surveys.summary.in_app.display_criteria.time_based_day")}`;
  } else {
    return `${days} ${t("workspace.surveys.summary.in_app.display_criteria.time_based_days")}`;
  }
};

interface DisplayCriteriaItemProps {
  icon: ReactNode;
  title: ReactNode;
  titleSuffix?: ReactNode;
  description: ReactNode;
}

const DisplayCriteriaItem = ({ icon, title, titleSuffix, description }: DisplayCriteriaItemProps) => {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-2">
      <div className="flex items-center justify-center">{icon}</div>
      <div className="flex items-center">
        <Small>
          {title} {titleSuffix && <InlineSmall>{titleSuffix}</InlineSmall>}
        </Small>
      </div>
      <div />
      <div className="flex items-start">
        <Small color="muted" margin="headerDescription">
          {description}
        </Small>
      </div>
    </div>
  );
};

export const AppTab = () => {
  const { t } = useTranslation();
  const { workspace } = useWorkspaceContext();
  const { survey } = useSurvey();

  const documentationLinks = useMemo(() => createDocumentationLinks(t), [t]);
  const noCodeConfigType = useMemo(() => createNoCodeConfigType(t), [t]);

  const waitTime = () => {
    if (survey.recontactDays !== null) {
      return formatRecontactDaysString(survey.recontactDays, t);
    }
    if (workspace.recontactDays !== null) {
      return formatRecontactDaysString(workspace.recontactDays, t);
    }
    return t("workspace.surveys.summary.in_app.display_criteria.time_based_always");
  };

  const displayOption = () => {
    if (survey.displayOption === "displayOnce") {
      return t("workspace.surveys.edit.show_only_once");
    } else if (survey.displayOption === "displayMultiple") {
      return t("workspace.surveys.edit.until_they_submit_a_response");
    } else if (survey.displayOption === "respondMultiple") {
      return t("workspace.surveys.edit.keep_showing_while_conditions_match");
    } else if (survey.displayOption === "displaySome") {
      return t("workspace.surveys.edit.show_multiple_times");
    }

    // Default fallback for undefined or unexpected displayOption values
    return t("workspace.surveys.edit.show_only_once");
  };

  const getTriggerDescription = (
    actionClass: TActionClass,
    noCodeConfigTypeParam: ReturnType<typeof createNoCodeConfigType>
  ) => {
    if (actionClass.type === "code") {
      return `(${t("workspace.surveys.summary.in_app.display_criteria.code_trigger")})`;
    } else {
      const configType = actionClass.noCodeConfig?.type;
      let configTypeLabel = "unknown";

      if (configType && configType in noCodeConfigTypeParam) {
        configTypeLabel = noCodeConfigTypeParam[configType];
      } else if (configType) {
        configTypeLabel = configType;
      }

      return `(${t("workspace.surveys.summary.in_app.display_criteria.no_code_trigger")}, ${configTypeLabel})`;
    }
  };

  const getSegmentTitle = (segment: TSegment | null) => {
    if (segment?.filters?.length && segment.filters.length > 0) {
      return segment.isPrivate
        ? t("workspace.surveys.summary.in_app.display_criteria.targeted")
        : segment.title;
    }
    return t("workspace.surveys.summary.in_app.display_criteria.everyone");
  };

  return (
    <div className="flex flex-col justify-between gap-y-6 pb-4">
      <div className="flex flex-col gap-y-6">
        <Alert variant={workspace.appSetupCompleted ? "success" : "warning"} size="default" role="status">
          <AlertTitle>
            {workspace.appSetupCompleted
              ? t("workspace.surveys.summary.in_app.connection_title")
              : t("workspace.surveys.summary.in_app.no_connection_title")}
          </AlertTitle>
          <AlertDescription>
            {workspace.appSetupCompleted
              ? t("workspace.surveys.summary.in_app.connection_description")
              : t("workspace.surveys.summary.in_app.no_connection_description")}
          </AlertDescription>
          {!workspace.appSetupCompleted && (
            <AlertButton asChild>
              <Link href={`/workspaces/${workspace?.id}/settings/workspace/app-connection`}>
                {t("common.connect_formbricks")}
              </Link>
            </AlertButton>
          )}
        </Alert>

        <div className="flex flex-col gap-y-3">
          <H4>{t("workspace.surveys.summary.in_app.display_criteria")}</H4>
          <div
            className={
              "flex w-full flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs"
            }>
            <DisplayCriteriaItem
              icon={<TimerResetIcon className="size-4" />}
              title={waitTime()}
              titleSuffix={
                survey.recontactDays !== null
                  ? `(${t("workspace.surveys.summary.in_app.display_criteria.overwritten")})`
                  : undefined
              }
              description={t("workspace.surveys.summary.in_app.display_criteria.time_based_description")}
            />
            <DisplayCriteriaItem
              icon={<UsersIcon className="size-4" />}
              title={getSegmentTitle(survey.segment)}
              description={t("workspace.surveys.summary.in_app.display_criteria.audience_description")}
            />
            {survey.triggers.map((trigger) => (
              <DisplayCriteriaItem
                key={trigger.actionClass.id}
                icon={
                  trigger.actionClass.type === "code" ? (
                    <CodeXmlIcon className="size-4" />
                  ) : (
                    <MousePointerClickIcon className="size-4" />
                  )
                }
                title={trigger.actionClass.name}
                titleSuffix={getTriggerDescription(trigger.actionClass, noCodeConfigType)}
                description={t("workspace.surveys.summary.in_app.display_criteria.trigger_description")}
              />
            ))}
            {survey.displayPercentage !== null && survey.displayPercentage > 0 && (
              <DisplayCriteriaItem
                icon={<PercentIcon className="size-4" />}
                title={t("workspace.surveys.summary.in_app.display_criteria.randomizer", {
                  percentage: survey.displayPercentage,
                })}
                description={t("workspace.surveys.summary.in_app.display_criteria.randomizer_description", {
                  percentage: survey.displayPercentage,
                })}
              />
            )}
            <DisplayCriteriaItem
              icon={<Repeat1Icon className="size-4" />}
              title={displayOption()}
              description={t("workspace.surveys.summary.in_app.display_criteria.recontact_description")}
            />
          </div>
        </div>
      </div>

      <DocumentationLinksSection
        title={t("workspace.surveys.summary.in_app.documentation_title")}
        links={documentationLinks}
      />
    </div>
  );
};
