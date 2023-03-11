import { OnboardingIcon } from "@/components/ui/icons/OnboardingIcon";
import { PMFIcon } from "@/components/ui/icons/PMFIcon";
import type { Template } from "@/types/template";

export const templates: Template[] = [
  {
    name: "Product Market Fit Survey",
    icon: PMFIcon,
    description:
      "Gauge your Product Market Fit by assessing how disappointed users would be if your product disappeared.",
    preset: {
      name: "Product Market Fit Survey",
      questions: [],
      audience: {},
    },
  },
  {
    name: "Profile New Users",
    icon: OnboardingIcon,
    description: "Find out how disappointed people would be if they could not use your service any more.",
    preset: {
      name: "Profile New Users",
      questions: [],
      audience: {},
    },
  },
];
