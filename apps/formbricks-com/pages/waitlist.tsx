import FeatureSelection from "@/components/engine/FeatureSelection";
import IconRadio from "@/components/engine/IconRadio";
import Input from "@/components/engine/Input";
import Scale from "@/components/engine/Scale";
import { Survey } from "@/components/engine/Survey";
import Textarea from "@/components/engine/Textarea";
import ThankYouHeading from "@/components/engine/ThankYouHeading";
import ThankYouPlans from "@/components/engine/ThankYouPlans";
import Layout from "@/components/shared/Layout";
import {
  BeakerIcon,
  BellIcon,
  BugAntIcon,
  BuildingOfficeIcon,
  ChatBubbleBottomCenterIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckCircleIcon,
  CodeBracketSquareIcon,
  CursorArrowRippleIcon,
  IdentificationIcon,
  NoSymbolIcon,
  RocketLaunchIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserIcon,
  UsersIcon,
  VideoCameraIcon,
  WindowIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

const WaitlistPage = () => (
  <Layout title="Waitlist" description="Join our Waitlist today">
    <h1 className="my-10 w-full px-4 text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
      Join Waitlist
    </h1>
    <div className="max-w-8xl mb-20 w-full px-4">
      <Survey
        formbricksUrl="http://localhost:3000"
        formId="cld1q32h7000619twdt9ykqza"
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
                    { label: "Founder", value: "founder", frontend: { icon: RocketLaunchIcon } },
                    {
                      label: "Product Manager",
                      value: "productManager",
                      frontend: { icon: WindowIcon },
                    },
                    { label: "Engineer", value: "engineer", frontend: { icon: CodeBracketSquareIcon } },
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
                    { label: "Companies", value: "companies", frontend: { icon: BuildingOfficeIcon } },
                    { label: "Consumers", value: "consumers", frontend: { icon: UsersIcon } },
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
                  label: "Pick two to get started",
                  name: "featureSelection",
                  options: [
                    {
                      label: "Onboarding Segmentation",
                      value: "onboardingSegmentation",
                      frontend: {
                        icon: IdentificationIcon,
                        description:
                          "Get to know your users right from the start. Ask a few questions early, let us enrich the profile.",
                      },
                    },
                    {
                      label: "Superhuman PMF Engine",
                      value: "pmf",
                      frontend: {
                        icon: UsersIcon,
                        description:
                          "Find out how disappointed people would be if they could not use your service any more.",
                      },
                    },
                    {
                      label: "Feature Chaser",
                      value: "featureChaser",
                      frontend: {
                        icon: BuildingOfficeIcon,
                        description: "Show a survey about a new feature shown only to people who used it.",
                      },
                    },
                    {
                      label: "Cancel Subscription Flow",
                      value: "cancelSubscriptionFlow",
                      frontend: {
                        icon: XCircleIcon,
                        description:
                          "Request users going through a cancel subscription flow before cancelling.",
                      },
                    },
                    {
                      label: "Interview Prompt",
                      value: "interviewPrompt",
                      frontend: {
                        icon: VideoCameraIcon,
                        description:
                          "Ask high-interest users to book a time in your calendar to get all the juicy details.",
                      },
                    },
                    {
                      label: "Fake Door Follow-Up",
                      value: "fakeDoorFollowUp",
                      frontend: {
                        icon: BeakerIcon,
                        description:
                          "Running a fake door experiment? Catch users right when they are full of expectations.",
                      },
                    },
                    {
                      label: "FeedbackBox",
                      value: "feedbackBox",
                      frontend: {
                        icon: ChatBubbleBottomCenterIcon,
                        description: "Give users the chance to share feedback in a single click.",
                      },
                    },
                    {
                      label: "Bug Report Form",
                      value: "bugReportForm",
                      frontend: {
                        icon: BugAntIcon,
                        description: "Catch all bugs in your SaaS with easy and accessible bug reports.",
                      },
                    },
                    {
                      label: "Rage Click Survey",
                      value: "rageClickSurvey",
                      frontend: {
                        icon: CursorArrowRippleIcon,
                        description:
                          "Sometimes things don’t work. Trigger this rage click survey to catch users in rage.",
                      },
                    },
                    {
                      label: "Feature Request Widget",
                      value: "featureRequestWidget",
                      frontend: {
                        icon: ChatBubbleBottomCenterTextIcon,
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
                    { label: "Not launched", value: "notLaunched", frontend: { icon: NoSymbolIcon } },
                    { label: "10-100", value: "10-100", frontend: { icon: UserIcon } },
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
                      frontend: { icon: UserCircleIcon },
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
                      frontend: { icon: CheckCircleIcon },
                    },
                    {
                      label: "No",
                      value: "no",
                      frontend: { icon: NoSymbolIcon },
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
  </Layout>
);

export default WaitlistPage;
