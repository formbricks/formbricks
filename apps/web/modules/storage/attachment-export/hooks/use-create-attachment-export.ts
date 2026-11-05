"use client";

import { useMutation } from "@tanstack/react-query";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { createAttachmentExport } from "../lib/api-client";

/**
 * Starts an attachment export. The server builds the ZIP in the background and emails the requester a
 * download link, so nothing here waits for or polls the build.
 */
export const useCreateAttachmentExport = ({ surveyId }: Readonly<{ surveyId: string }>) =>
  useMutation({
    mutationFn: (variables: { filterCriteria?: TResponseFilterCriteria }) =>
      createAttachmentExport({ surveyId, filterCriteria: variables.filterCriteria }),
  });
