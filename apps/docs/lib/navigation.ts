import type { NavGroup } from "@/components/Navigation";

export const navigation: Array<NavGroup> = [
  {
    title: "Introduction",
    links: [
      { title: "What is Formbricks?", href: "/docs/introduction/what-is-formbricks" },
      { title: "Why is it better?", href: "/docs/introduction/why-is-it-better" },
      { title: "How does it work?", href: "/docs/introduction/how-it-works" },
    ],
  },
  {
    title: "In-App Surveys",
    links: [
      { title: "Quickstart", href: "/docs/getting-started/quickstart-in-app-survey" },
      { title: "Developer Quickstart", href: "/docs/in-app-surveys/developer-quickstart" },
      { title: "Framework Guides", href: "/docs/getting-started/framework-guides" },
      { title: "Troubleshooting", href: "/docs/getting-started/troubleshooting" },
      { title: "Identify Users", href: "/docs/in-app-surveys/user-identification" },
      { title: "Actions", href: "/docs/in-app-surveys/actions" },
      { title: "Attributes", href: "/docs/in-app-surveys/attributes" },
      { title: "Advanced Targeting", href: "/docs/in-app-surveys/advanced-targeting" },
      { title: "Recontact Options", href: "/docs/in-app-surveys/recontact" },
    ],
  },
  {
    title: "Link Surveys",
    links: [
      { title: "Quickstart", href: "/docs/link-surveys/quickstart" },
      { title: "Data Prefilling", href: "/docs/link-surveys/data-prefilling" },
      { title: "Identify Users", href: "/docs/link-surveys/user-identification" },
      { title: "Single Use Links", href: "/docs/link-surveys/single-use-links" },
      { title: "Source Tracking", href: "/docs/link-surveys/source-tracking" },
      { title: "Hidden Fields", href: "/docs/link-surveys/hidden-fields" },
      { title: "Start At Question", href: "/docs/link-surveys/start-at-question" },
      { title: "Embed Surveys in Website", href: "/docs/link-surveys/embed-surveys" },
      { title: "Embed Surveys in Email", href: "/docs/link-surveys/embed-in-email" },
    ],
  },
  {
    title: "Additional Features",
    links: [
      { title: "API", href: "/docs/additional-features/api" },
      { title: "Multi-Language Surveys", href: "/docs/additional-features/multi-language-surveys" },
      { title: "Metadata", href: "/docs/additional-features/metadata" },
    ],
  },
  {
    title: "Best Practices",
    links: [
      { title: "Learn from Churn", href: "/docs/best-practices/cancel-subscription" },
      { title: "Interview Prompt", href: "/docs/best-practices/interview-prompt" },
      { title: "Product-Market Fit", href: "/docs/best-practices/pmf-survey" },
      { title: "Trial Conversion", href: "/docs/best-practices/improve-trial-cr" },
      { title: "Feature Chaser", href: "/docs/best-practices/feature-chaser" },
      { title: "Feedback Box", href: "/docs/best-practices/feedback-box" },
      { title: "Docs Feedback", href: "/docs/best-practices/docs-feedback" },
      { title: "Improve Email Content", href: "/docs/best-practices/improve-email-content" },
    ],
  },
  {
    title: "Integrations",
    links: [
      { title: "Airtable", href: "/docs/integrations/airtable" },
      { title: "Google Sheets", href: "/docs/integrations/google-sheets" },
      { title: "Notion", href: "/docs/integrations/notion" },
      { title: "Make.com", href: "/docs/integrations/make" },
      { title: "n8n", href: "/docs/integrations/n8n" },
      { title: "Slack", href: "/docs/integrations/slack" },
      { title: "Wordpress", href: "/docs/integrations/wordpress" },
      { title: "Zapier", href: "/docs/integrations/zapier" },
    ],
  },
  {
    title: "Self-hosting",
    links: [
      { title: "Introduction", href: "/docs/self-hosting/deployment" },
      { title: "One-Click Setup", href: "/docs/self-hosting/production" },
      { title: "Advanced Setup", href: "/docs/self-hosting/docker" },
      { title: "Configure", href: "/docs/self-hosting/external-auth-providers" },
      { title: "Migration Guide", href: "/docs/self-hosting/migration-guide" },
      { title: "License", href: "/docs/self-hosting/license" },
      { title: "Enterprise License", href: "/docs/self-hosting/enterprise" },
    ],
  },
  {
    title: "Contributing",
    links: [
      { title: "Introduction", href: "/docs/contributing/introduction" },
      { title: "Demo App", href: "/docs/contributing/demo" },
      { title: "Setup Dev Environment", href: "/docs/contributing/setup" },
      { title: "How we code at Formbricks", href: "/docs/contributing/how-we-code" },
      { title: "How to create a service", href: "/docs/contributing/creating-a-service" },
      { title: "Troubleshooting", href: "/docs/contributing/troubleshooting" },
      { title: "FAQ", href: "/docs/faq" },
    ],
  },
];
