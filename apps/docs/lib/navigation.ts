import type { NavGroup } from "@/components/navigation";

export const navigation: NavGroup[] = [
  {
    title: "Introduction",
    links: [
      { title: "What is Formbricks?", href: "/introduction/what-is-formbricks" },
      { title: "Why open source?", href: "/introduction/why-open-source" },
      { title: "How does it work?", href: "/introduction/how-it-works" },
      {
        title: "Best Practices",
        children: [
          { title: "Learn from Churn", href: "/best-practices/cancel-subscription" },
          { title: "Interview Prompt", href: "/best-practices/interview-prompt" },
          { title: "Product-Market Fit", href: "/best-practices/pmf-survey" },
          { title: "Trial Conversion", href: "/best-practices/improve-trial-cr" },
          { title: "Feature Chaser", href: "/best-practices/feature-chaser" },
          { title: "Feedback Box", href: "/best-practices/feedback-box" },
          { title: "Docs Feedback", href: "/best-practices/docs-feedback" },
          { title: "Improve Email Content", href: "/best-practices/improve-email-content" },
          { title: "Contact Form", href: "/best-practices/contact-form" },
          { title: "Quiz Time", href: "/best-practices/quiz-time" },
        ],
      },
    ],
  },
  {
    title: "Link Surveys",
    links: [
      { title: "Quickstart", href: "/link-surveys/quickstart" },
      {
        title: "Features",
        children: [
          { title: "Data Prefilling", href: "/link-surveys/data-prefilling" },
          { title: "Single Use Links", href: "/link-surveys/single-use-links" },
          { title: "Source Tracking", href: "/link-surveys/source-tracking" },
          { title: "Hidden Fields", href: "/link-surveys/global/hidden-fields" },
          { title: "Start At Question", href: "/link-surveys/start-at-question" },
          { title: "Embed Surveys Anywhere", href: "/link-surveys/embed-surveys" },
          { title: "Market Research Panel", href: "/link-surveys/market-research-panel" },
          { title: "Multi-Language Surveys", href: "/link-surveys/global/multi-language-surveys" },
          { title: "User Metadata", href: "/link-surveys/global/metadata" },
          { title: "Custom Styling", href: "/link-surveys/global/overwrite-styling" }, // global
          { title: "Conditional Logic", href: "/link-surveys/global/conditional-logic" },
          { title: "Shareable Dashboards", href: "/link-surveys/global/shareable-dashboards" },
          { title: "Start & End Dates", href: "/link-surveys/global/schedule-start-end-dates" },
          { title: "Limit submissions", href: "/link-surveys/global/limit-submissions" }, // global
          { title: "Recall Data", href: "/link-surveys/global/recall" },
          { title: "Verify Email before Survey", href: "/link-surveys/verify-email-before-survey" },
          { title: "PIN Protected Surveys", href: "/link-surveys/pin-protected-surveys" },
          { title: "Partial Submissions", href: "/link-surveys/global/partial-submissions" },
          {
            title: "Add Image/Video to Question",
            href: "/link-surveys/global/add-image-or-video-question",
          },
          { title: "Variables", href: "/link-surveys/global/variables" },
        ],
      },
    ],
  },
  {
    title: "Website & App Surveys",
    links: [
      { title: "Quickstart", href: "/app-surveys/quickstart" },
      { title: "Framework Guides", href: "/app-surveys/framework-guides" },
      {
        title: "Features",
        children: [
          { title: "Identify Users", href: "/app-surveys/user-identification" },
          { title: "Actions", href: "/app-surveys/actions" },
          { title: "Advanced Targeting", href: "/app-surveys/advanced-targeting" },
          { title: "Show Survey to % of users", href: "/app-surveys/global/show-survey-to-percent-of-users" }, // app and website
          { title: "Recontact Options", href: "/app-surveys/recontact" },
          { title: "Hidden Fields", href: "/app-surveys/global/hidden-fields" }, // global
          { title: "Multi-Language Surveys", href: "/app-surveys/global/multi-language-surveys" }, // global
          { title: "User Metadata", href: "/app-surveys/global/metadata" }, // global
          { title: "Custom Styling", href: "/app-surveys/global/overwrite-styling" }, // global
          { title: "Conditional Logic", href: "/app-surveys/global/conditional-logic" }, // global
          { title: "Start & End Dates", href: "/app-surveys/global/schedule-start-end-dates" }, // global
          { title: "Limit submissions", href: "/app-surveys/global/limit-submissions" }, // global
          { title: "Recall Data", href: "/app-surveys/global/recall" }, // global
          { title: "Partial Submissions", href: "/app-surveys/global/partial-submissions" }, // global
          { title: "Shareable Dashboards", href: "/app-surveys/global/shareable-dashboards" },
          {
            title: "Add Image/Video to Question",
            href: "/app-surveys/global/add-image-or-video-question",
          },
          { title: "Variables", href: "/app-surveys/global/variables" },
        ],
      },
    ],
  },
  {
    title: "Core Features",
    links: [
      {
        title: "Question Types",
        children: [
          { title: "Free Text", href: "/core-features/global/question-type/free-text" },
          { title: "Select Single", href: "/core-features/global/question-type/single-select" },
          { title: "Select Multiple", href: "/core-features/global/question-type/multi-select" },
          { title: "Select Picture", href: "/core-features/global/question-type/picture-selection" },
          { title: "Rating", href: "/core-features/global/question-type/rating" },
          { title: "Net Promoter Score", href: "/core-features/global/question-type/net-promoter-score" },
          { title: "Ranking", href: "/core-features/global/question-type/ranking" },
          { title: "Matrix", href: "/core-features/global/question-type/matrix" },
          { title: "Statement (Call to Action)", href: "/core-features/global/question-type/statement-cta" },
          { title: "Consent", href: "/core-features/global/question-type/consent" },
          { title: "File Upload", href: "/core-features/global/question-type/file-upload" },
          { title: "Date", href: "/core-features/global/question-type/date" },
          { title: "Schedule a Meeting", href: "/core-features/global/question-type/schedule" },
          { title: "Address", href: "/core-features/global/question-type/address" },
          { title: "Contact Info", href: "/core-features/global/question-type/contact" },
        ],
      },
      {
        title: "Integrations",
        children: [
          { title: "Overview", href: "/developer-docs/integrations/overview" },
          { title: "Airtable", href: "/developer-docs/integrations/airtable" },
          { title: "Google Sheets", href: "/developer-docs/integrations/google-sheets" },
          { title: "Make", href: "/developer-docs/integrations/make" },
          { title: "n8n", href: "/developer-docs/integrations/n8n" },
          { title: "Notion", href: "/developer-docs/integrations/notion" },
          { title: "Slack", href: "/developer-docs/integrations/slack" },
          { title: "Wordpress", href: "/developer-docs/integrations/wordpress" },
          { title: "Zapier", href: "/developer-docs/integrations/zapier" },
        ],
      },
      { title: "User Management", href: "/core-features/global/access-roles" },
      { title: "Styling Theme", href: "/core-features/global/styling-theme" },
      { title: "Email Customization", href: "/core-features/global/email-customization" },
    ],
  },
  {
    title: "Self-Hosting",
    links: [
      { title: "Overview", href: "/self-hosting/overview" },
      { title: "One-Click Setup", href: "/self-hosting/one-click" },
      { title: "Custom SSL Certificate", href: "/self-hosting/custom-ssl" },
      { title: "Docker Setup", href: "/self-hosting/docker" },
      { title: "Migration Guide", href: "/self-hosting/migration-guide" },
      { title: "Configuration", href: "/self-hosting/configuration" },
      { title: "Integrations", href: "/self-hosting/integrations" },
      { title: "License", href: "/self-hosting/license" },
      { title: "Cluster Setup", href: "/self-hosting/cluster-setup" },
      { title: "Rate Limiting", href: "/self-hosting/rate-limiting" },
    ],
  },
  {
    title: "Developer Docs",
    links: [
      { title: "Overview", href: "/developer-docs/overview" },
      { title: "SDK: Formbricks JS", href: "/developer-docs/js-sdk" },
      { title: "SDK: React Native", href: "/developer-docs/react-native-in-app-surveys" },
      { title: "SDK: Formbricks API", href: "/developer-docs/api-sdk" },
      { title: "REST API", href: "/developer-docs/rest-api" },
      { title: "Webhooks", href: "/developer-docs/webhooks" },
      {
        title: "Contributing",
        children: [
          { title: "Get started", href: "/developer-docs/contributing/get-started" },
          { title: "Troubleshooting", href: "/developer-docs/contributing/troubleshooting" },
        ],
      },
    ],
  },
];
