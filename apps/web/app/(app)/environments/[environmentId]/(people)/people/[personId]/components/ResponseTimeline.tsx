"use client";

import { ResponseFeed } from "@/app/(app)/environments/[environmentId]/(people)/people/[personId]/components/ResponsesFeed";
import { TTeamPermission } from "@/modules/ee/teams/product-teams/types/teams";
import { ArrowDownUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";

interface ResponseTimelineProps {
  surveys: TSurvey[];
  user: TUser;
  responses: TResponse[];
  environment: TEnvironment;
  environmentTags: TTag[];
  attributeClasses: TAttributeClass[];
  locale: TUserLocale;
  productPermission: TTeamPermission | null;
}

export const ResponseTimeline = ({
  surveys,
  user,
  environment,
  responses,
  environmentTags,
  attributeClasses,
  locale,
  productPermission,
}: ResponseTimelineProps) => {
  const t = useTranslations();
  const [sortedResponses, setSortedResponses] = useState(responses);
  const toggleSortResponses = () => {
    setSortedResponses([...sortedResponses].reverse());
  };

  useEffect(() => {
    setSortedResponses(responses);
  }, [responses]);

  return (
    <div className="md:col-span-3">
      <div className="flex items-center justify-between pb-6">
        <h2 className="text-lg font-bold text-slate-700">{t("common.responses")}</h2>
        <div className="text-right">
          <button
            type="button"
            onClick={toggleSortResponses}
            className="hover:text-brand-dark flex items-center px-1 text-slate-800">
            <ArrowDownUpIcon className="inline h-4 w-4" />
          </button>
        </div>
      </div>
      <ResponseFeed
        responses={sortedResponses}
        environment={environment}
        surveys={surveys}
        user={user}
        environmentTags={environmentTags}
        attributeClasses={attributeClasses}
        locale={locale}
        productPermission={productPermission}
      />
    </div>
  );
};
