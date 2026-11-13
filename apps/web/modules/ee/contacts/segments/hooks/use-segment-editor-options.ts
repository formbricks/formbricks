"use client";

import { useQuery } from "@tanstack/react-query";
import { contactQueryKeys } from "@/modules/ee/contacts/lib/query-keys";
import { getContactAttributeKeyValues, listSegmentFilterSurveys } from "../lib/api-client";

/** The values an attribute has, for the segment editor's value picker. Off until there is a key. */
export const useContactAttributeKeyValues = (contactAttributeKeyId: string) =>
  useQuery({
    queryKey: contactQueryKeys.attributeKeyValues(contactAttributeKeyId),
    queryFn: ({ signal }) => getContactAttributeKeyValues(contactAttributeKeyId, { signal }),
    enabled: contactAttributeKeyId !== "",
  });

/** The surveys a survey-interaction filter can name, for the segment editor's survey picker. */
export const useSegmentFilterSurveys = (workspaceId: string) =>
  useQuery({
    queryKey: contactQueryKeys.segmentFilterSurveys(workspaceId),
    queryFn: ({ signal }) => listSegmentFilterSurveys(workspaceId, { signal }),
  });
