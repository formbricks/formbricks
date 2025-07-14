"use client";

import { useEnvironment } from "@/app/(app)/environments/[environmentId]/context/EnvironmentContext";
import { useSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/SurveyContext";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { H4, Small } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";
import { ClockIcon, MousePointerClickIcon, PercentIcon, Repeat1Icon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { TActionClass } from "@formbricks/types/action-classes";
import { DocumentationLinksSection } from "./documentation-links-section";

interface DisplayCriteriaItemProps {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
}

const DisplayCriteriaItem = ({ icon, title, description }: DisplayCriteriaItemProps) => {
  return (
    <div className="flex gap-2">
      {icon}
      <div className="flex flex-col">
        <Small>{title}</Small>
        <Small color="muted" margin="headerDescription">
          {description}
        </Small>
      </div>
    </div>
  );
};

export const AppTab = () => {
  const { t } = useTranslate();
  const { environment, project } = useEnvironment();
  const { survey } = useSurvey();

  const documentationLinks = [
    {
      href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides#html",
      title: t("environments.surveys.summary.in_app.html_embed"),
    },
    {
      href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides#react-js",
      title: t("environments.surveys.summary.in_app.javascript_sdk"),
    },
    {
      href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides#swift",
      title: t("environments.surveys.summary.in_app.ios_sdk"),
    },
    {
      href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides#android",
      title: t("environments.surveys.summary.in_app.kotlin_sdk"),
    },
    {
      href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides#react-native",
      title: t("environments.surveys.summary.in_app.react_native_sdk"),
    },
  ];

  const formatRecontactDaysString = (days: number) => {
    if (days === 0) {
      return t("environments.surveys.summary.in_app.display_criteria.time_based_always");
    } else if (days === 1) {
      return `${days} ${t("environments.surveys.summary.in_app.display_criteria.time_based_day")}`;
    } else {
      return `${days} ${t("environments.surveys.summary.in_app.display_criteria.time_based_days")}`;
    }
  };

  const waitTime = () => {
    if (survey.recontactDays !== null) {
      const waitingTime = formatRecontactDaysString(survey.recontactDays);
      return `${waitingTime} ${t("environments.surveys.summary.in_app.display_criteria.overwritten")}`;
    }
    if (project.recontactDays !== null) {
      return formatRecontactDaysString(project.recontactDays);
    }
    return t("environments.surveys.summary.in_app.display_criteria.time_based_always");
  };

  const displayOption = () => {
    if (survey.displayOption === "displayOnce") {
      return t("environments.surveys.edit.show_only_once");
    } else if (survey.displayOption === "displayMultiple") {
      return t("environments.surveys.edit.until_they_submit_a_response");
    } else if (survey.displayOption === "respondMultiple") {
      return t("environments.surveys.edit.keep_showing_while_conditions_match");
    } else if (survey.displayOption === "displaySome") {
      return t("environments.surveys.edit.show_multiple_times");
    }
  };

  const getTriggerDescription = (actionClass: TActionClass) => {
    let triggerDescription = `${actionClass.name}`;

    if (actionClass.type === "code") {
      triggerDescription += ` (${t("environments.surveys.summary.in_app.display_criteria.code_trigger")})`;
    } else {
      const noCodeConfigType = {
        click: t("environments.actions.click"),
        pageView: t("environments.actions.page_view"),
        exitIntent: t("environments.actions.exit_intent"),
        fiftyPercentScroll: t("environments.actions.fifty_percent_scroll"),
      };
      triggerDescription += ` (${t("environments.surveys.summary.in_app.display_criteria.no_code_trigger")}, ${noCodeConfigType[actionClass.noCodeConfig?.type as keyof typeof noCodeConfigType]})`;
    }

    return triggerDescription;
  };

  return (
    <div className="flex flex-col justify-between space-y-6 pb-4">
      <div className="flex flex-col space-y-6">
        <Alert variant={environment.appSetupCompleted ? "success" : "warning"} size="default">
          <AlertTitle>
            {environment.appSetupCompleted
              ? t("environments.surveys.summary.in_app.connection_title")
              : t("environments.surveys.summary.in_app.no_connection_title")}
          </AlertTitle>
          <AlertDescription>
            {environment.appSetupCompleted
              ? t("environments.surveys.summary.in_app.connection_description")
              : t("environments.surveys.summary.in_app.no_connection_description")}
          </AlertDescription>
          {!environment.appSetupCompleted && (
            <AlertButton asChild>
              <Link href={`/environments/${environment.id}/project/app-connection`}>
                {t("common.connect_formbricks")}
              </Link>
            </AlertButton>
          )}
        </Alert>

        <div className="flex flex-col space-y-3">
          <H4>{t("environments.surveys.summary.in_app.display_criteria")}</H4>
          <div
            className={
              "flex w-full flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm"
            }>
            <DisplayCriteriaItem
              icon={<ClockIcon className="h-4 w-4" />}
              title={waitTime()}
              description={t("environments.surveys.summary.in_app.display_criteria.time_based_description")}
            />
            <DisplayCriteriaItem
              icon={<UsersIcon className="h-4 w-4" />}
              title={
                survey.segment?.filters?.length && survey.segment.filters.length > 0
                  ? t("environments.surveys.summary.in_app.display_criteria.targeted")
                  : t("environments.surveys.summary.in_app.display_criteria.everyone")
              }
              description={t("environments.surveys.summary.in_app.display_criteria.audience_description")}
            />
            {survey.triggers.map((trigger) => (
              <DisplayCriteriaItem
                key={trigger.actionClass.id}
                icon={<MousePointerClickIcon className="h-4 w-4" />}
                title={getTriggerDescription(trigger.actionClass)}
                description={t("environments.surveys.summary.in_app.display_criteria.trigger_description")}
              />
            ))}
            {survey.displayPercentage && survey.displayPercentage > 0 && (
              <DisplayCriteriaItem
                icon={<PercentIcon className="h-4 w-4" />}
                title={t("environments.surveys.summary.in_app.display_criteria.randomizer", {
                  percentage: survey.displayPercentage,
                })}
                description={t(
                  "environments.surveys.summary.in_app.display_criteria.randomizer_description",
                  {
                    percentage: survey.displayPercentage,
                  }
                )}
              />
            )}
            <DisplayCriteriaItem
              icon={<Repeat1Icon className="h-4 w-4" />}
              title={displayOption()}
              description={t("environments.surveys.summary.in_app.display_criteria.recontact_description")}
            />
          </div>
        </div>
      </div>

      <DocumentationLinksSection
        title={t("environments.surveys.summary.in_app.documentation_title")}
        links={documentationLinks}
      />
    </div>
  );
};
