"use client";

import { LoginForm } from "@/modules/auth/login/components/login-form";
import { LinkSurveyWrapper } from "@/modules/survey/link/components/link-survey-wrapper";
import { SurveyLinkUsed } from "@/modules/survey/link/components/survey-link-used";
import { getPrefillValue } from "@/modules/survey/link/lib/utils";
import { SurveyInline } from "@/modules/ui/components/survey";
import { useUser } from "@account-kit/react";
import { Project, Response } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TResponseData, TResponseHiddenFieldValue } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

let setQuestionId = (_: string) => {};
let setResponseData = (_: TResponseData) => {};

interface LinkSurveyProps {
  survey: TSurvey;
  project: Pick<Project, "styling" | "logo" | "linkSurveyBranding">;
  singleUseId?: string;
  singleUseResponse?: Pick<Response, "id" | "finished">;
  webAppUrl: string;
  responseCount?: number;
  languageCode: string;
  isEmbed: boolean;
  isPreview: boolean;
  contactId?: string;
}

export const LinkSurvey = ({
  survey,
  project,
  singleUseId,
  singleUseResponse,
  webAppUrl,
  responseCount,
  languageCode,
  isEmbed,
  isPreview,
  contactId,
}: LinkSurveyProps) => {
  const responseId = singleUseResponse?.id;
  const searchParams = useSearchParams();
  const skipPrefilled = searchParams.get("skipPrefilled") === "true";
  const user = useUser();

  const startAt = searchParams.get("startAt");
  const isStartAtValid = useMemo(() => {
    if (!startAt) return false;
    if (survey.welcomeCard.enabled && startAt === "start") return true;

    const isValid = survey.questions.some((question) => question.id === startAt);

    // To remove startAt query param from URL if it is not valid:
    if (!isValid && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("startAt");
      window.history.replaceState({}, "", url.toString());
    }

    return isValid;
  }, [survey, startAt]);

  const prefillValue = getPrefillValue(survey, searchParams, languageCode);

  const [autoFocus, setAutofocus] = useState(false);
  const hasFinishedSingleUseResponse = useMemo(() => {
    if (singleUseResponse?.finished) {
      return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once
  }, []);

  // Not in an iframe, enable autofocus on input fields.
  useEffect(() => {
    if (window.self === window.top) {
      setAutofocus(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once
  }, []);

  const hiddenFieldsRecord = useMemo<TResponseHiddenFieldValue>(() => {
    const fieldsRecord: TResponseHiddenFieldValue = {};

    survey.hiddenFields.fieldIds?.forEach((field) => {
      const answer = searchParams.get(field);
      if (answer) {
        fieldsRecord[field] = answer;
      }
    });

    return fieldsRecord;
  }, [searchParams, survey.hiddenFields.fieldIds]);

  const getVerifiedEmail = useMemo<Record<string, string> | null>(() => {
    if (user?.email && user?.address) {
      return { verifiedEmail: user.email, verifiedAddress: user.address };
    } else {
      return null;
    }
  }, [user]);

  if (hasFinishedSingleUseResponse) {
    return <SurveyLinkUsed singleUseMessage={survey.singleUse} />;
  }

  if (!user?.email || !user?.address) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="mx-auto max-w-xs rounded-xl border bg-white">
          <LoginForm
            emailAuthEnabled={false}
            isMultiOrgEnabled={false}
            passwordResetEnabled={false}
            publicSignUpEnabled={false}
          />
        </div>
      </div>
    );
  }

  const determineStyling = () => {
    // Check if style overwrite is disabled at the project level
    if (!project.styling.allowStyleOverwrite) {
      return project.styling;
    }

    // Return survey styling if survey overwrites are enabled, otherwise return project styling
    return survey.styling?.overwriteThemeStyling ? survey.styling : project.styling;
  };

  const handleResetSurvey = () => {
    setQuestionId(survey.welcomeCard.enabled ? "start" : survey.questions[0].id);
    setResponseData({});
  };

  return (
    <LinkSurveyWrapper
      project={project}
      surveyId={survey.id}
      isWelcomeCardEnabled={survey.welcomeCard.enabled}
      isPreview={isPreview}
      surveyType={survey.type}
      handleResetSurvey={handleResetSurvey}
      determineStyling={determineStyling}
      isEmbed={isEmbed}
      isBrandingEnabled={project.linkSurveyBranding}>
      <SurveyInline
        appUrl={webAppUrl}
        environmentId={survey.environmentId}
        isPreviewMode={isPreview}
        survey={survey}
        styling={determineStyling()}
        languageCode={languageCode}
        isBrandingEnabled={project.linkSurveyBranding}
        shouldResetQuestionId={false}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- need it as focus behaviour is different in normal surveys and survey preview
        autoFocus={autoFocus}
        prefillResponseData={prefillValue}
        skipPrefilled={skipPrefilled}
        responseCount={responseCount}
        getSetQuestionId={(f: (value: string) => void) => {
          setQuestionId = f;
        }}
        getSetResponseData={(f: (value: TResponseData) => void) => {
          setResponseData = f;
        }}
        startAtQuestionId={startAt && isStartAtValid ? startAt : undefined}
        fullSizeCards={isEmbed}
        hiddenFieldsRecord={{
          ...hiddenFieldsRecord,
          ...getVerifiedEmail,
        }}
        singleUseId={singleUseId}
        singleUseResponseId={responseId}
        getSetIsResponseSendingFinished={(_f: (value: boolean) => void) => {}}
        contactId={contactId}
      />
    </LinkSurveyWrapper>
  );
};
