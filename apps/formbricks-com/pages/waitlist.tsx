import IconRadio from "@/components/engine/IconRadio";
import Input from "@/components/engine/Input";
import { Survey } from "@/components/engine/Survey";
import Textarea from "@/components/engine/Textarea";
import ThankYouHeading from "@/components/engine/ThankYouHeading";
import HeroTitle from "@/components/shared/HeroTitle";
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
  UserMinusIcon,
  UsersIcon,
  VideoCameraIcon,
  WindowIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

const WaitlistPage = () => (
  <Layout title="Waitlist" description="Join our Waitlist today">
    <h1 className="my-10 w-full text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
      Join Waitlist
    </h1>
    <div className="max-w-8xl mb-20 w-full">
      <Survey
        survey={{
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
                  field: "role",
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
                  field: "targetGroup",
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
              config: {
                autoSubmit: true,
              },
              elements: [
                {
                  id: "featureSelection",
                  type: "radio",
                  label: "Pick two to get started",
                  field: "featureSelection",
                  options: [
                    {
                      label: "Onboarding Segmentation",
                      value: "onboardingSegmentation",
                      frontend: { icon: IdentificationIcon },
                    },
                    { label: "Superhuman PMF Engine", value: "pmf", frontend: { icon: UsersIcon } },
                    {
                      label: "Feature Chaser",
                      value: "featureChaser",
                      frontend: { icon: BuildingOfficeIcon },
                    },
                    {
                      label: "Cancel Subscription Flow",
                      value: "cancelSubscriptionFlow",
                      frontend: { icon: XCircleIcon },
                    },
                    {
                      label: "Interview Prompt",
                      value: "interviewPrompt",
                      frontend: { icon: VideoCameraIcon },
                    },
                    {
                      label: "Fake Door Follow-Up",
                      value: "fakeDoorFollowUp",
                      frontend: { icon: BeakerIcon },
                    },
                    {
                      label: "FeedbackBox",
                      value: "feedbackBox",
                      frontend: { icon: ChatBubbleBottomCenterIcon },
                    },
                    {
                      label: "Bug Report Form",
                      value: "onboardingSegmentation",
                      frontend: { icon: BugAntIcon },
                    },
                    {
                      label: "Rage Click Survey",
                      value: "rageClickSurvey",
                      frontend: { icon: CursorArrowRippleIcon },
                    },
                    {
                      label: "Feature Request Widget",
                      value: "featureRequestWidget",
                      frontend: { icon: ChatBubbleBottomCenterTextIcon },
                    },
                  ],
                  component: IconRadio,
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
                  field: "email",
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
                  field: "targetGroup",
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
                  field: "goal",
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
                  field: "goal",
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
                  field: "name",
                  component: Input,
                },
              ],
            },
            {
              id: "urgencyPage",
              elements: [
                {
                  id: "urgency",
                  type: "text",
                  label: "How urgently do you need this?",
                  field: "urgency",
                  component: Input,
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
                  field: "pmf",
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
                  field: "pmf",
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
                  field: "scalingResearch",
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
                  field: "triedSolveIt",
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
                  field: "toolsMaintainPmf",
                  component: Textarea,
                },
              ],
              branchingRules: [
                {
                  type: "value",
                  field: "pmf",
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
                  field: "pmfApproach",
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
                  field: "pmfHardestPart",
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
                  field: "pmfFindingTools",
                  component: Textarea,
                },
              ],
              branchingRules: [
                {
                  type: "value",
                  field: "pmf",
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
              ],
            },
          ],
        }}
      />
    </div>
  </Layout>
);

export default WaitlistPage;
