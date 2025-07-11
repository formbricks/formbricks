"use client";

import { useEnvironment } from "@/app/(app)/environments/[environmentId]/context/EnvironmentContext";
import { useSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/SurveyContext";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { H4, Small } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";
import { ClockIcon, MousePointerClickIcon, PercentIcon, Repeat1Icon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { DocumentationLinksSection } from "./DocumentationLinksSection";

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

  const waitTime = () => {
    if (survey.recontactDays !== null) {
      let waitingTime = "";

      if (survey.recontactDays === 0) {
        waitingTime = t("environments.surveys.summary.in_app.display_criteria.time_based_always");
      } else if (survey.recontactDays === 1) {
        waitingTime = `${survey.recontactDays} ${t("environments.surveys.summary.in_app.display_criteria.time_based_day")}`;
      } else {
        waitingTime = `${survey.recontactDays} ${t("environments.surveys.summary.in_app.display_criteria.time_based_days")}`;
      }
      return `${waitingTime} ${t("environments.surveys.summary.in_app.display_criteria.overwritten")}`;
    }
    if (project.recontactDays !== null) {
      if (project.recontactDays === 0) {
        return `${project.recontactDays} ${t("environments.surveys.summary.in_app.display_criteria.time_based_always")}`;
      } else if (project.recontactDays === 1) {
        return `${project.recontactDays} ${t("environments.surveys.summary.in_app.display_criteria.time_based_day")}`;
      } else {
        return `${project.recontactDays} ${t("environments.surveys.summary.in_app.display_criteria.time_based_days")}`;
      }
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

  return (
    <div className="flex flex-col justify-between space-y-6 pb-4">
      <div className="flex flex-col space-y-6">
        <Alert variant={environment.appSetupCompleted ? "success" : "warning"} size="default">
          <AlertTitle>{t("environments.surveys.summary.in_app.connection_title")}</AlertTitle>
          <AlertDescription>
            {t("environments.surveys.summary.in_app.connection_description")}
          </AlertDescription>
          {!environment.appSetupCompleted && (
            <AlertButton asChild>
              <Link href={`/environments/${environment.id}/project/app-connection`}>
                {t("environments.surveys.summary.in_app.connection_button")}
              </Link>
            </AlertButton>
          )}
        </Alert>

        <div className="flex flex-col space-y-4">
          <H4>{t("environments.surveys.summary.in_app.display_criteria")}</H4>
          <div className={"w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"}>
            <div className="flex flex-col space-y-4">
              <div className="flex gap-2">
                <ClockIcon className="h-4 w-4" />
                <div className="flex flex-col">
                  <Small>{waitTime()}</Small>
                  <Small color="muted" margin="headerDescription">
                    {t("environments.surveys.summary.in_app.display_criteria.time_based_description")}
                  </Small>
                </div>
              </div>
              <div className="flex gap-2">
                <UsersIcon className="h-4 w-4" />
                <div className="flex flex-col">
                  <Small>
                    {survey.segment?.filters?.length && survey.segment.filters.length > 0
                      ? t("environments.surveys.summary.in_app.display_criteria.targeted")
                      : t("environments.surveys.summary.in_app.display_criteria.everyone")}
                  </Small>
                  <Small color="muted" margin="headerDescription">
                    {t("environments.surveys.summary.in_app.display_criteria.audience_description")}
                  </Small>
                </div>
              </div>
              <div className="flex gap-2">
                <MousePointerClickIcon className="h-4 w-4" />
                <div className="flex flex-col">
                  <Small>Action name</Small>
                  <Small color="muted" margin="headerDescription">
                    Survey Trigger
                  </Small>
                </div>
              </div>
              {survey.displayPercentage && survey.displayPercentage > 0 && (
                <div className="flex gap-2">
                  <PercentIcon className="h-4 w-4" />
                  <div className="flex flex-col">
                    <Small>
                      {t("environments.surveys.summary.in_app.display_criteria.randomizer", {
                        percentage: survey.displayPercentage,
                      })}
                    </Small>
                    <Small color="muted" margin="headerDescription">
                      {t("environments.surveys.summary.in_app.display_criteria.randomizer_description", {
                        percentage: survey.displayPercentage,
                      })}
                    </Small>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Repeat1Icon className="h-4 w-4" />
                <div className="flex flex-col">
                  <Small>{displayOption()}</Small>
                  <Small color="muted" margin="headerDescription">
                    {t("environments.surveys.summary.in_app.display_criteria.recontact_description")}
                  </Small>
                </div>
              </div>
            </div>
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
