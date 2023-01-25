import FeatureSelection from "@/components/engine/FeatureSelection";
import IconRadio from "@/components/engine/IconRadio";
import Input from "@/components/engine/Input";
import Scale from "@/components/engine/Scale";
import { Survey } from "@/components/engine/Survey";
import Textarea from "@/components/engine/Textarea";
import ThankYouHeading from "@/components/engine/ThankYouHeading";
import ThankYouPlans from "@/components/engine/ThankYouPlans";
import LayoutWaitlist from "@/components/shared/LayoutWaitlist";
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
          formbricksUrl={
            process.env.NODE_ENV === "production" ? "https://app.formbricks.com" : "http://localhost:3000"
          }
          formId={
            process.env.NODE_ENV === "production" ? "cld37mt2i0000ld08p9q572bc" : "clda41dvz0004u08k3gbawcky"
          }
          survey={{
            config: {
              progressBar: false,
            },
            pages: [
              {
                id: "pmfTypePage",
                config: {
                  autoSubmit: true,
                },
                elements: [
                  {
                    id: "pmfType",
                    component: IconRadio,
                    type: "radio",
                    name: "pmfType",
                    label: "How disappointed would you be if you could no longer use our service?",
                    options: [
                      { label: "Very disappointed", value: "veryDisappointed" },
                      { label: "Somewhat disappointed", value: "somewhatDisappointed" },
                      { label: "Not disappointed", value: "notDisappointed" },
                    ],
                  },
                ],
              },
              {
                id: "mainBenefitPage",
                elements: [
                  {
                    id: "mainBenefit",
                    component: Textarea,
                    type: "text",
                    name: "mainBenefit",
                    label: "What is the main benefit you receive from our service?",
                  },
                ],
              },
              {
                id: "userSegmentPage",
                config: {
                  autoSubmit: true,
                },
                elements: [
                  {
                    id: "userSegment",
                    component: IconRadio,
                    type: "radio",
                    name: "userSegment",
                    label: "What is your job title?",
                    options: [
                      { label: "Founder", value: "founder" },
                      { label: "Executive", value: "executive" },
                      { label: "Product Manager", value: "product manager" },
                      { label: "Software Engineer", value: "engineer" },
                    ],
                  },
                ],
              },
              {
                id: "improvementPage",
                elements: [
                  {
                    id: "improvement",
                    component: Textarea,
                    type: "text",
                    name: "improvement",
                    label: "How can we improve our service for you?",
                  },
                ],
              },
              {
                id: "selfSegmentationPage",
                elements: [
                  {
                    id: "selfSegmentation",
                    component: Textarea,
                    type: "text",
                    name: "selfSegmentation",
                    label: "What type of people would benefit most from using our service?",
                  },
                ],
              },
              {
                id: "thankYouPage",
                endScreen: true,
                elements: [
                  {
                    id: "thankYou",
                    component: ThankYouHeading,
                    type: "html",
                    name: "thankYou",
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
