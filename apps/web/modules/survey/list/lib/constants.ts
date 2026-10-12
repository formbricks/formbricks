import { TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";

export const initialFilters: TSurveyOverviewFilters = {
  name: "",
  status: [],
  type: [],
  visibility: [],
  sortBy: "relevance",
};
