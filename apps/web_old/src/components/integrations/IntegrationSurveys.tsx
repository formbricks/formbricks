import {
  SegmentLogoImage,
  MixpanelLogoImage,
  AmplitudeLogoImage,
  PosthogLogoImage,
  JuneLogoImage,
  HeapLogoImage,
  HubspotLogoImage,
  SalesforceLogoImage,
  CustomerIOLogoImage,
  BrazeLogoImage,
} from "./LogoImages";
import IconCheckbox from "./IconCheckbox";
import ThankYouPage from "./ThankYouPage";
import { useSession } from "next-auth/react";
import LoadingSpinner from "../LoadingSpinner";
import { FormbricksEngine } from "@formbricks/engine-react";

export const DataInSurvey = () => {
  const { data: session, status } = useSession();
  if (status === "loading") return <LoadingSpinner />;

  return (
    <FormbricksEngine
      formbricksUrl={
        process.env.NODE_ENV === "production" ? "https://app.formbricks.com" : "http://localhost:3000"
      }
      formId={
        process.env.NODE_ENV === "production" ? "cldvn1r6x0002s00gnw01lj40" : "cldvkpx11000019a0aoucngcb"
      }
      customer={{ email: session.user.email }}
      schema={{
        config: {
          progressBar: false,
        },
        pages: [
          {
            id: "DataInPage",
            config: {
              autoSubmit: false,
            },
            elements: [
              {
                id: "dataIn",
                type: "radio",
                label: "Data-Out: User Profiles and CRM",
                name: "dataIn",
                options: [
                  { label: "Segment", value: "segmentIn", frontend: { icon: SegmentLogoImage } },
                  {
                    label: "Mixpanel",
                    value: "mixpanel",
                    frontend: { icon: MixpanelLogoImage },
                  },
                  { label: "Amplitude", value: "amplitude", frontend: { icon: AmplitudeLogoImage } },
                  { label: "PostHog", value: "posthog", frontend: { icon: PosthogLogoImage } },
                  { label: "Heap", value: "heap", frontend: { icon: HeapLogoImage } },
                  { label: "June", value: "june", frontend: { icon: JuneLogoImage } },
                ],
                component: IconCheckbox,
              },
            ],
          },
          {
            id: "thankYouPage",
            endScreen: true,
            elements: [
              {
                id: "thankYou",
                type: "html",
                component: ThankYouPage,
              },
            ],
          },
        ],
      }}
    />
  );
};

export const DataOutSurvey = () => {
  const { data: session, status } = useSession();
  if (status === "loading") return <LoadingSpinner />;

  return (
    <FormbricksEngine
      formbricksUrl={
        process.env.NODE_ENV === "production" ? "https://app.formbricks.com" : "http://localhost:3000"
      }
      formId={
        process.env.NODE_ENV === "production" ? "cldvn4fk30003s00gum3rkvma" : "cldvku70u000319a0xokj8cku"
      }
      customer={{ email: session.user.email }}
      schema={{
        config: {
          progressBar: false,
        },
        pages: [
          {
            id: "DataInPage",
            config: {
              autoSubmit: false,
            },
            elements: [
              {
                id: "dataIn",
                type: "checkbox",
                name: "dataIn",
                label: "Data-In: Pre-Segmentation",
                options: [
                  { label: "Segment", value: "segmentOut", frontend: { icon: SegmentLogoImage } },
                  {
                    label: "Hubspot",
                    value: "hubspot",
                    frontend: { icon: HubspotLogoImage },
                  },
                  { label: "customer.io", value: "customerio", frontend: { icon: CustomerIOLogoImage } },
                  { label: "Salesforce", value: "salesforce", frontend: { icon: SalesforceLogoImage } },
                  { label: "braze", value: "braze", frontend: { icon: BrazeLogoImage } },
                ],
                component: IconCheckbox,
              },
            ],
          },
          {
            id: "thankYouPage",
            endScreen: true,
            elements: [
              {
                id: "thankYou",
                type: "html",
                component: ThankYouPage,
              },
            ],
          },
        ],
      }}
    />
  );
};
