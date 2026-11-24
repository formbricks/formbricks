"use client";

import { useQuery } from "@tanstack/react-query";
import { contactQueryKeys } from "@/modules/ee/contacts/lib/query-keys";
import { getContactAttributeKeyValues, listSegmentFilterSurveys } from "../lib/api-client";

/**
 * The values an attribute has, for the segment editor's value picker, read through the workspace the editor
 * is open in. Off until there is a key and a workspace.
 */
export const useContactAttributeKeyValues = (
  contactAttributeKeyId: string,
  workspaceId: string | undefined
) =>
  useQuery({
    queryKey: contactQueryKeys.attributeKeyValues(contactAttributeKeyId, workspaceId ?? ""),
    queryFn: ({ signal }) =>
      getContactAttributeKeyValues(contactAttributeKeyId, workspaceId ?? "", { signal }),
    enabled: contactAttributeKeyId !== "" && !!workspaceId,
  });

/**
 * The surveys a survey-interaction filter can name, for the segment editor's survey picker, and which of
 * `surveyIds` belong to another workspace on the directory.
 */
export const useSegmentFilterSurveys = (workspaceId: string, surveyIds: readonly string[]) =>
  useQuery({
    queryKey: contactQueryKeys.segmentFilterSurveys(workspaceId, surveyIds),
    queryFn: ({ signal }) => listSegmentFilterSurveys(workspaceId, surveyIds, { signal }),
  });
