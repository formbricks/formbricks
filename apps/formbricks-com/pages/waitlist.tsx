import FeatureSelection from "@/components/engine/FeatureSelection";
import IconRadio from "@/components/engine/IconRadio";
import Input from "@/components/engine/Input";
import Scale from "@/components/engine/Scale";
import { Survey } from "@/components/engine/Survey";
import Textarea from "@/components/engine/Textarea";
import ThankYouHeading from "@/components/engine/ThankYouHeading";
import ThankYouPlans from "@/components/engine/ThankYouPlans";
import LayoutWaitlist from "@/components/shared/LayoutWaitlist";
import { NoSymbolIcon, UserIcon } from "@heroicons/react/24/outline";
import {
  OnboardingIcon,
  PMFIcon,
  DogChaserIcon,
  CancelSubscriptionIcon,
  InterviewPromptIcon,
  DoorIcon,
  FeedbackIcon,
  BugBlueIcon,
  AngryBirdRageIcon,
  FeatureRequestIcon,
  FounderIcon,
  EngineerIcon,
  LaptopWorkerIcon,
  UserCommentIcon,
  UserGroupIcon,
  BellIcon,
  SkyscraperIcon,
  CheckMarkIcon,
  CrossMarkIcon,
  UserCoupleIcon,
} from "@formbricks/ui";

const WaitlistPage = () => (
  <LayoutWaitlist title="Waitlist" description="Join our Waitlist today">
    <div className="mx-auto w-full max-w-5xl px-6 md:w-3/4">
      <div className="px-4 pt-20 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          <span className="xl:inline">Get</span>{" "}
          <span className="from-brand-light to-brand-dark bg-gradient-to-b bg-clip-text text-transparent xl:inline">
            early
          </span>{" "}
          <span className="inline ">access</span>
        </h1>
        <p className="mt-3 text-sm text-slate-400 dark:text-slate-300 md:text-base">
          We are onboarding users continuously. Tell us more about you!
        </p>
      </div>

      <div className="mx-auto my-6 w-full max-w-5xl rounded-xl bg-slate-100 px-8 py-10 dark:bg-slate-800 md:my-12 md:px-16 md:py-20">
        <Survey
          formbricksUrl="https://app.formbricks.com"
          formId="cld37mt2i0000ld08p9q572bc"
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
                    label: "How would you describe your role?",
                    name: "role",
                    options: [
                      { label: "Founder", value: "founder", frontend: { icon: FounderIcon } },
                      {
                        label: "Product Manager",
                        value: "productManager",
                        frontend: { icon: LaptopWorkerIcon },
                      },
                      { label: "Engineer", value: "engineer", frontend: { icon: EngineerIcon } },
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
                    label: "Who are you serving?",
                    name: "targetGroup",
                    options: [
                      { label: "Companies", value: "companies", frontend: { icon: SkyscraperIcon } },
                      { label: "Consumers", value: "consumers", frontend: { icon: UserGroupIcon } },
                    ],
                    component: IconRadio,
                  },
                ],
              },
              {
                id: "featureSelectionPage",
                elements: [
                  {
                    id: "featureSelection",
                    type: "radio",
                    label: "Pick 2 to get started",
                    name: "featureSelection",
                    options: [
                      {
                        label: "Onboarding Segmentation",
                        value: "onboardingSegmentation",
                        frontend: {
                          icon: OnboardingIcon,
                          description:
                            "Get to know your users right from the start. Ask a few questions early, let us enrich the profile.",
                        },
                      },
                      {
                        label: "Superhuman PMF Engine",
                        value: "pmf",
                        frontend: {
                          icon: PMFIcon,
                          description:
                            "Find out how disappointed people would be if they could not use your service any more.",
                        },
                      },
                      {
                        label: "Feature Chaser",
                        value: "featureChaser",
                        frontend: {
                          icon: DogChaserIcon,
                          description: "Show a survey about a new feature shown only to people who used it.",
                        },
                      },
                      {
                        label: "Cancel Subscription Flow",
                        value: "cancelSubscriptionFlow",
                        frontend: {
                          icon: CancelSubscriptionIcon,
                          description:
                            "Request users going through a cancel subscription flow before cancelling.",
                        },
                      },
                      {
                        label: "Interview Prompt",
                        value: "interviewPrompt",
                        frontend: {
                          icon: InterviewPromptIcon,
                          description:
                            "Ask high-interest users to book a time in your calendar to get all the juicy details.",
                        },
                      },
                      {
                        label: "Fake Door Follow-Up",
                        value: "fakeDoorFollowUp",
                        frontend: {
                          icon: DoorIcon,
                          description:
                            "Running a fake door experiment? Catch users right when they are full of expectations.",
                        },
                      },
                      {
                        label: "FeedbackBox",
                        value: "feedbackBox",
                        frontend: {
                          icon: FeedbackIcon,
                          description: "Give users the chance to share feedback in a single click.",
                        },
                      },
                      {
                        label: "Bug Report Form",
                        value: "bugReportForm",
                        frontend: {
                          icon: BugBlueIcon,
                          description: "Catch all bugs in your SaaS with easy and accessible bug reports.",
                        },
                      },
                      {
                        label: "Rage Click Survey",
                        value: "rageClickSurvey",
                        frontend: {
                          icon: AngryBirdRageIcon,
                          description:
                            "Sometimes things don’t work. Trigger this rage click survey to catch users in rage.",
                        },
                      },
                      {
                        label: "Feature Request Widget",
                        value: "featureRequestWidget",
                        frontend: {
                          icon: FeatureRequestIcon,
                          description:
                            "Allow users to request features and pipe it to GitHub projects or Linear.",
                        },
                      },
                    ],
                    component: FeatureSelection,
                  },
                ],
              },
              {
                id: "emailPage",
                elements: [
                  {
                    id: "email",
                    type: "text",
                    label: "What's your email?",
                    name: "email",
                    frontend: {
                      required: true,
                      type: "email",
                      placeholder: "email@example.com",
                    },
                    component: Input,
                  },
                ],
              },
              {
                id: "wauPage",
                config: {
                  autoSubmit: true,
                },
                elements: [
                  {
                    id: "wau",
                    type: "radio",
                    label: "How many weekly active users do you have?",
                    name: "wau",
                    options: [
                      { label: "Not launched", value: "notLaunched", frontend: { icon: CrossMarkIcon } },
                      { label: "10-100", value: "10-100", frontend: { icon: UserCoupleIcon } },
                      { label: "100-1.000", value: "100-1000", frontend: { icon: UserGroupIcon } },
                      { label: "1.000+", value: "10000+", frontend: { icon: UserGroupIcon } },
                    ],
                    component: IconRadio,
                  },
                ],
              },
              {
                id: "goalPage",
                config: {
                  autoSubmit: true,
                },
                elements: [
                  {
                    id: "goal",
                    type: "radio",
                    label: "What are you here for?",
                    name: "goal",
                    options: [
                      {
                        label: "Just notify me on launch",
                        value: "justNotify",
                        frontend: { icon: BellIcon },
                      },
                      {
                        label: "Become a beta user",
                        value: "becomeBetaUser",
                        frontend: { icon: UserCommentIcon },
                      },
                    ],
                    component: IconRadio,
                  },
                ],
                branchingRules: [
                  {
                    type: "value",
                    name: "goal",
                    value: "justNotify",
                    nextPageId: "thankYouPageNotify",
                  },
                ],
              },
              {
                id: "namePage",
                elements: [
                  {
                    id: "name",
                    type: "text",
                    label: "First of all, what’s your name?",
                    name: "name",
                    frontend: { placeholder: "First name" },
                    component: Input,
                  },
                ],
              },
              {
                id: "urgencyPage",
                config: {
                  autoSubmit: true,
                },
                elements: [
                  {
                    id: "urgency",
                    type: "radio",
                    label: "How urgently do you need this?",
                    name: "urgency",
                    options: [
                      { label: "1", value: "1" },
                      { label: "2", value: "2" },
                      { label: "3", value: "3" },
                      { label: "4", value: "4" },
                      { label: "5", value: "5" },
                      { label: "6", value: "6" },
                      { label: "7", value: "7" },
                      { label: "8", value: "8" },
                      { label: "9", value: "9" },
                      { label: "10", value: "10" },
                    ],
                    frontend: {
                      min: 1,
                      max: 10,
                      minLabel: "I’m just curious",
                      maxLabel: "As soon as possible",
                    },
                    component: Scale,
                  },
                ],
              },
              {
                id: "pmfPage",
                config: {
                  autoSubmit: true,
                },
                elements: [
                  {
                    id: "pmf",
                    type: "radio",
                    label: "Have you found Product-Market-Fit?",
                    name: "pmf",
                    options: [
                      {
                        label: "Yes",
                        value: "yes",
                        frontend: { icon: CheckMarkIcon },
                      },
                      {
                        label: "No",
                        value: "no",
                        frontend: { icon: CrossMarkIcon },
                      },
                    ],
                    component: IconRadio,
                  },
                ],
                branchingRules: [
                  {
                    type: "value",
                    name: "pmf",
                    value: "no",
                    nextPageId: "pmfApproachPage",
                  },
                ],
              },
              {
                id: "scalingResearchPage",
                elements: [
                  {
                    id: "scalingResearch",
                    type: "text",
                    label: "The hardest part about scaling user research is...",
                    name: "scalingResearch",
                    frontend: { placeholder: "Please complete the sentence." },
                    component: Textarea,
                  },
                ],
              },
              {
                id: "triedSolveItPage",
                elements: [
                  {
                    id: "triedSolveIt",
                    type: "text",
                    label: "We have tried to solve it by...",
                    name: "triedSolveIt",
                    frontend: { placeholder: "Please complete the sentence." },
                    component: Textarea,
                  },
                ],
              },
              {
                id: "toolsMaintainPmfPage",
                elements: [
                  {
                    id: "toolsMaintainPmf",
                    type: "text",
                    label: "What tools help you maintain Product-Market Fit?",
                    name: "toolsMaintainPmf",
                    frontend: { placehodler: "Mixpanel, Segment, Intercom..." },
                    component: Textarea,
                  },
                ],
                branchingRules: [
                  {
                    type: "value",
                    name: "pmf",
                    value: "yes",
                    nextPageId: "thankYouPageBetaUser",
                  },
                ],
              },
              {
                id: "pmfApproachPage",
                elements: [
                  {
                    id: "pmfApproach",
                    type: "text",
                    label: "What is your approach for finding Product-Market Fit?",
                    name: "pmfApproach",
                    frontend: { placeholder: "Last time, I..." },
                    component: Textarea,
                  },
                ],
              },
              {
                id: "pmfHardestPartPage",
                elements: [
                  {
                    id: "pmfHardestPart",
                    type: "text",
                    label: "What is the hardest part about it?",
                    name: "pmfHardestPart",
                    frontend: { placeholder: "Please complete the sentence." },
                    component: Textarea,
                  },
                ],
              },
              {
                id: "pmfFindingToolsPage",
                elements: [
                  {
                    id: "pmfFindingTools",
                    type: "text",
                    label: "What tools help you finding Product-Market Fit?",
                    name: "pmfFindingTools",
                    frontend: { placeholder: "Mixpanel, Segment, Intercom..." },
                    component: Textarea,
                  },
                ],
                branchingRules: [
                  {
                    type: "value",
                    name: "pmf",
                    value: "no",
                    nextPageId: "thankYouPageBetaUser",
                  },
                ],
              },
              {
                id: "thankYouPageNotify",
                endScreen: true,
                elements: [
                  {
                    id: "thankYouNotify",
                    type: "html",
                    component: ThankYouHeading,
                  },
                ],
              },
              {
                id: "thankYouPageBetaUser",
                endScreen: true,
                elements: [
                  {
                    id: "thankYouBetaUser",
                    type: "html",
                    component: ThankYouHeading,
                  },
                  {
                    id: "thankYouBetaUser",
                    type: "html",
                    component: ThankYouPlans,
                  },
                ],
              },
            ],
          }}
        />
      </div>
    </div>
  </LayoutWaitlist>
);

export default WaitlistPage;
