"use client";

import { useQuery } from "@tanstack/react-query";
import { getResponseCard } from "../lib/api-client";
import { responseCardKeys } from "../lib/query";

/** A response as the card renders it, read once a response is picked (`responseId` set). */
export const useResponseCard = (responseId: string | null) =>
  useQuery({
    queryKey: responseCardKeys.detail(responseId ?? ""),
    enabled: responseId !== null,
    queryFn: ({ signal }) => getResponseCard(responseId as string, { signal }),
  });
