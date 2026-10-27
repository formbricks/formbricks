"use client";

import { useQuery } from "@tanstack/react-query";
import { getSurveyRetention } from "../lib/api-client";
import { surveyRetentionKeys } from "../lib/query";

/** What data retention will do to one survey. */
export const useSurveyRetention = ({ surveyId }: Readonly<{ surveyId: string }>) =>
  useQuery({
    queryKey: surveyRetentionKeys.detail(surveyId),
    queryFn: ({ signal }) => getSurveyRetention({ surveyId, signal }),
  });
