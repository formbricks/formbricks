import IconRadio from "./IconRadio";
import { FormbricksEngine } from "@formbricks/engine-react";
import ForwardToApp from "./ForwardToApp";
import { useSession } from "next-auth/react";

const OnboardingSurvey = () => {
  const { data: session, status } = useSession();
  return (
    <FormbricksEngine
      formbricksUrl={
        process.env.NODE_ENV === "production" ? "https://app.formbricks.com" : "http://localhost:3000"
      }
      formId={
        process.env.NODE_ENV === "production" ? "cld37mt2i0000ld08p9q572bc" : "cldu2c8810006yz2w3o5ubfrh"
      }
      customer={{
        email: session.user.email,
      }}
      survey={{
        config: {
          progressBar: false,
        },
        pages: [
          {
            id: "rolePage",
            config: {
              autoSubmit: true,
            },
            elements: [
              {
                id: "role",
                type: "radio",
                label: "The hardest part about user research is...",
                /*  help: "Helps us focus on what you need most.", */
                name: "role",
                options: [
                  { label: "Not sure where to start", value: "notSureWhereToStart" },
                  {
                    label: "Unresponsive users",
                    value: "unresponsiveUsers",
                  },
                  { label: "Small user base", value: "smallUserBase" },
                  { label: "Doing it consistently", value: "consistency" },
                  { label: "Implementing methods", value: "Implementation" },
                ],
                component: IconRadio,
              },
            ],
          },
          {
            id: "targetGroupPage",
            config: {
              autoSubmit: true,
            },
            elements: [
              {
                id: "targetGroup",
                type: "radio",
                label: "When was the last time you talked to one of your users?",
                /* help: "(honest answers only)", */
                name: "targetGroup",
                options: [
                  { label: "Today", value: "today" },
                  {
                    label: "Yesterday",
                    value: "yesterday",
                  },
                  { label: "This week", value: "thisWeek" },
                  { label: "This month", value: "thisMonth" },
                  { label: "I should do that more often", value: "iShouldDoThatMoreOften" },
                ],
                component: IconRadio,
              },
            ],
          },
          {
            id: "onboardingDone",
            endScreen: true,
            elements: [
              {
                id: "forward",
                type: "html",
                component: ForwardToApp,
              },
            ],
          },
        ],
      }}
    />
  );
};

export default OnboardingSurvey;
