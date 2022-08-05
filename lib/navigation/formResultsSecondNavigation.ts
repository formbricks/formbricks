import {
  ChartBarIcon,
  InboxIcon,
  TrendingUpIcon,
} from "@heroicons/react/outline";
import { useRouter } from "next/router";

export const useFormResultsSecondNavigation = (formId) => {
  const router = useRouter();
  return [
    {
      id: "summary",
      onClick: () => {
        router.push(`/forms/${formId}/results/summary`);
      },
      Icon: ChartBarIcon,
      label: "Summary",
    },
    {
      id: "responses",
      onClick: () => {
        router.push(`/forms/${formId}/results/responses`);
      },
      Icon: InboxIcon,
      label: "Responses",
    },
    {
      id: "insights",
      onClick: () => {
        router.push(`/forms/${formId}/results/insights`);
      },
      Icon: TrendingUpIcon,
      label: "Insights",
    },
  ];
};
