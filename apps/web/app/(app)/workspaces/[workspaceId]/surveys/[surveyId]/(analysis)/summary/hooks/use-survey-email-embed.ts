"use client";

import { useQuery } from "@tanstack/react-query";
import { getSurveyEmailEmbed } from "../lib/api-client";

export const surveyEmailEmbedKey = (surveyId: string) => ["surveys", surveyId, "email-embed"] as const;

/**
 * The survey rendered as an email body, for the share modal's Email tab. Rendered afresh each time the tab
 * opens, as it always was: the workspace's query cache outlives a trip to the editor, and the embed code the
 * tab copies must match the survey as it is now.
 */
export const useSurveyEmailEmbed = (surveyId: string) =>
  useQuery({
    queryKey: surveyEmailEmbedKey(surveyId),
    queryFn: ({ signal }) => getSurveyEmailEmbed(surveyId, signal),
    staleTime: 0,
    gcTime: 0,
  });
