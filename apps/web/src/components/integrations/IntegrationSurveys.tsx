import { Survey } from "./Survey";
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

/* import SegmentLogo from "@/images/logos/segment-logo.png";
import MixpanelLogo from "@/images/logos/mixpanel-logo.png";
import AmplitudeLogo from "@/images/logos/amplitude-logo.png";
import PosthogLogo from "@/images/logos/posthog-logo.png";
import HeapLogo from "@/images/logos/heap-logo.png";
import JuneLogo from "@/images/logos/june-logo.png";
import CustomerIOLogo from "@/images/logos/customerio-logo.png";
import SalesforceLogo from "@/images/logos/salesforce-logo.png";
import BrazeLogo from "@/images/logos/braze-logo.png";
import HubspotLogo from "@/images/logos/hubspot-logo.png"; */

export const DataInSurvey = () => (
  <Survey
    formbricksUrl={
      process.env.NODE_ENV === "production" ? "https://app.formbricks.com" : "http://localhost:3000"
    }
    formId={process.env.NODE_ENV === "production" ? "cld37mt2i0000ld08p9q572bc" : "cldonm4ra000019axa4oc440z"}
    survey={{
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
              label: "Test 2",
              name: "dataIn",
              options: [
                { label: "Segment", value: "segment", frontend: { icon: SegmentLogoImage } },
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
      ],
    }}
  />
);

export const DataOutSurvey = () => (
  <Survey
    formbricksUrl={
      process.env.NODE_ENV === "production" ? "https://app.formbricks.com" : "http://localhost:3000"
    }
    formId={process.env.NODE_ENV === "production" ? "cld37mt2i0000ld08p9q572bc" : "cldonm4ra000019axa4oc440z"}
    survey={{
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
              label: "Test",
              name: "dataIn",
              options: [
                { label: "Segment", value: "segment", frontend: { icon: SegmentLogoImage } },
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
      ],
    }}
  />
);
