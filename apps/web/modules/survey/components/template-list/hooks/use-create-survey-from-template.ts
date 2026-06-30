"use client";

import { useMutation } from "@tanstack/react-query";
import { createSurveyFromTemplate } from "@/modules/survey/components/template-list/lib/v3-template-client";

export const useCreateSurveyFromTemplate = () => {
  return useMutation({
    mutationFn: createSurveyFromTemplate,
  });
};
