import { OnboardingIcon } from "@/components/ui/icons/OnboardingIcon";
import { PMFIcon } from "@/components/ui/icons/PMFIcon";
import type { Template } from "@/types/templates";
import { createId } from "@paralleldrive/cuid2";

export const templates: Template[] = [
  {
    name: "Product Market Fit Survey",
    icon: PMFIcon,
    description:
      "Gauge your Product Market Fit by assessing how disappointed users would be if your product disappeared.",
    preset: {
      name: "Product Market Fit Survey",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "How disappointed would you be if you could no longer use this product?",
          subheader: "Please select one of the following options.",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Not at all disappointed",
            },
            {
              id: createId(),
              label: "Somewhat disappointed",
            },
            {
              id: createId(),
              label: "Very disappointed",
            },
          ],
        },
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What is your role?",
          subheader: "Please select one of the following options.",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Founder",
            },
            {
              id: createId(),
              label: "Executive",
            },
            {
              id: createId(),
              label: "Product Manager",
            },
            {
              id: createId(),
              label: "Product Owner",
            },
            {
              id: createId(),
              label: "Software Engineer",
            },
          ],
        },
        {
          id: createId(),
          type: "openText",
          headline: "How can we improve our service for you?",
          subheader: "Please be as specific as possible.",
          required: true,
        },
      ],
    },
  },
  {
    name: "Profile New Users",
    icon: OnboardingIcon,
    description: "Find out how disappointed people would be if they could not use your service any more.",
    preset: {
      name: "Profile New Users",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What is your role?",
          subheader: "Please select one of the following options.",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Founder",
            },
            {
              id: createId(),
              label: "Executive",
            },
            {
              id: createId(),
              label: "Product Manager",
            },
            {
              id: createId(),
              label: "Product Owner",
            },
            {
              id: createId(),
              label: "Software Engineer",
            },
          ],
        },
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What's your company size?",
          subheader: "Please select one of the following options.",
          required: true,
          choices: [
            {
              id: createId(),
              label: "only me",
            },
            {
              id: createId(),
              label: "0-5 employees",
            },
            {
              id: createId(),
              label: "6-10 employees",
            },
            {
              id: createId(),
              label: "11-50 employees",
            },
            {
              id: createId(),
              label: "51-100 employees",
            },
            {
              id: createId(),
              label: "> 100 employees",
            },
          ],
        },
      ],
    },
  },
];
