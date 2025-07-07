"use client";

import { FORMBRICKS_SURVEYS_FILTERS_KEY_LS } from "@/lib/localStorage";
import { getSurveysAction } from "@/modules/survey/list/actions";
import { getFormattedFilters } from "@/modules/survey/list/lib/utils";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { Button } from "@/modules/ui/components/button";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { wrapThrows } from "@formbricks/types/error-handlers";
import { TProjectConfigChannel } from "@formbricks/types/project";
import { TSurveyFilters } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SurveyCard } from "./survey-card";
import { SurveyFilters } from "./survey-filters";
import { SurveyLoading } from "./survey-loading";

interface SurveysListProps {
  environmentId: string;
  isReadOnly: boolean;
  publicDomain: string;
  userId: string;
  surveysPerPage: number;
  currentProjectChannel: TProjectConfigChannel;
  locale: TUserLocale;
}

export const initialFilters: TSurveyFilters = {
  name: "",
  createdBy: [],
  status: [],
  type: [],
  sortBy: "relevance",
};

export const SurveysList = ({
  environmentId,
  isReadOnly,
  publicDomain,
  userId,
  surveysPerPage: surveysLimit,
  currentProjectChannel,
  locale,
}: SurveysListProps) => {
  const [surveys, setSurveys] = useState<TSurvey[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const { t } = useTranslate();
  const [surveyFilters, setSurveyFilters] = useState<TSurveyFilters>(initialFilters);
  const [isFilterInitialized, setIsFilterInitialized] = useState(false);

  const filters = useMemo(() => getFormattedFilters(surveyFilters, userId), [surveyFilters, userId]);
  const [parent] = useAutoAnimate();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedFilters = localStorage.getItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
      if (savedFilters) {
        const surveyParseResult = wrapThrows(() => JSON.parse(savedFilters))();

        if (!surveyParseResult.ok) {
          localStorage.removeItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
          setSurveyFilters(initialFilters);
        } else {
          setSurveyFilters(surveyParseResult.data);
        }
      }
      setIsFilterInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (isFilterInitialized) {
      localStorage.setItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS, JSON.stringify(surveyFilters));
    }
  }, [surveyFilters, isFilterInitialized]);

  useEffect(() => {
    if (isFilterInitialized) {
      const fetchInitialSurveys = async () => {
        setIsFetching(true);
        const res = await getSurveysAction({
          environmentId,
          limit: surveysLimit,
          offset: undefined,
          filterCriteria: filters,
        });
        if (res?.data) {
          if (res.data.length < surveysLimit) {
            setHasMore(false);
          } else {
            setHasMore(true);
          }
          setSurveys(res.data);
          setIsFetching(false);
        }
      };
      fetchInitialSurveys();
    }
  }, [environmentId, surveysLimit, filters, isFilterInitialized, refreshTrigger]);

  const fetchNextPage = useCallback(async () => {
    setIsFetching(true);
    const res = await getSurveysAction({
      environmentId,
      limit: surveysLimit,
      offset: surveys.length,
      filterCriteria: filters,
    });
    if (res?.data) {
      if (res.data.length === 0 || res.data.length < surveysLimit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setSurveys([...surveys, ...res.data]);
      setIsFetching(false);
    }
  }, [environmentId, surveys, surveysLimit, filters]);

  const handleDeleteSurvey = async (surveyId: string) => {
    const newSurveys = surveys.filter((survey) => survey.id !== surveyId);
    setSurveys(newSurveys);
    if (newSurveys.length === 0) setIsFetching(true);
  };

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => !prev);
  }, []);

  return (
    <div className="space-y-6">
      <SurveyFilters
        surveyFilters={surveyFilters}
        setSurveyFilters={setSurveyFilters}
        currentProjectChannel={currentProjectChannel}
      />
      {surveys.length > 0 ? (
        <div>
          <div className="flex-col space-y-3" ref={parent}>
            <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 pr-8 text-sm text-slate-800">
              <div className="col-span-2 place-self-start">Name</div>
              <div className="col-span-1">{t("common.status")}</div>
              <div className="col-span-1">{t("common.responses")}</div>
              <div className="col-span-1">{t("common.type")}</div>
              <div className="col-span-1">{t("common.created_at")}</div>
              <div className="col-span-1">{t("common.updated_at")}</div>
              <div className="col-span-1">{t("common.created_by")}</div>
            </div>
            {surveys.map((survey) => {
              return (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  environmentId={environmentId}
                  isReadOnly={isReadOnly}
                  publicDomain={publicDomain}
                  deleteSurvey={handleDeleteSurvey}
                  locale={locale}
                  onSurveysCopied={triggerRefresh}
                />
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center py-5">
              <Button onClick={fetchNextPage} variant="secondary" size="sm" loading={isFetching}>
                {t("common.load_more")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-full w-full">
          {isFetching ? (
            <SurveyLoading />
          ) : (
            <div className="flex w-full flex-col items-center justify-center text-slate-600">
              <span className="h-24 w-24 p-4 text-center text-5xl">🕵️</span>
              {t("common.no_surveys_found")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
