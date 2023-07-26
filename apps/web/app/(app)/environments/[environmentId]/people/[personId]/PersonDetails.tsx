"use client";

import { TPersonWithDetailedAttributes } from "@formbricks/types/v1/people";
import { TDisplaysWithSurveyName } from "@formbricks/types/v1/displays";
import { TSessionWithActions } from "@formbricks/types/v1/sessions";
import { TResponseWithSurveyQuestions } from "@formbricks/types/v1/responses";
import HeadingSection from "@/app/(app)/environments/[environmentId]/people/[personId]/HeadingSection";
import ResponseSection from "@/app/(app)/environments/[environmentId]/people/[personId]/ResponseSection";
import ActivitySection from "@/app/(app)/environments/[environmentId]/people/[personId]/ActivitySection";

interface PersonDetailsProps {
  environmentId: string;
  personWithAttributes: TPersonWithDetailedAttributes;
  sessionsWithActions: TSessionWithActions[];
  responsesWithSurveyData: TResponseWithSurveyQuestions[];
  displays: TDisplaysWithSurveyName[];
  children: React.ReactNode;
}

export default function PersonDetails({
  environmentId,
  personWithAttributes,
  sessionsWithActions,
  responsesWithSurveyData,
  displays,
  children,
}: PersonDetailsProps) {
  const personEmail = personWithAttributes?.attributes?.find((attribute) => attribute.name === "email");

  return (
    <>
      <HeadingSection
        environmentId={environmentId}
        personEmail={personEmail}
        personId={personWithAttributes.id}
      />
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-1 gap-x-8  md:grid-cols-4">
          {children}
          <ResponseSection environmentId={environmentId} responsesWithSurveyData={responsesWithSurveyData} />

          <ActivitySection
            environmentId={environmentId}
            sessionsWithActions={sessionsWithActions}
            attributes={personWithAttributes?.attributes}
            displays={displays}
          />
        </div>
      </section>
    </>
  );
}
