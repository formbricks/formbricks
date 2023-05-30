import Layout from "@/components/shared/Layout";
import HeroTitle from "@/components/shared/HeroTitle";
import { Button } from "@formbricks/ui";

const OSSFriends = [
   {
    name: "Webstudio",
    description:
      "Webstudio is an open source alternative to Webflow",
    href: "https://webstudio.is",
  },
   {
    name: "BoxyHQ",
    description:
      "BoxyHQ’s suite of APIs for security and privacy helps engineering teams build and ship compliant cloud applications faster.",
    href: "https://boxyhq.com",
  },
  {
    name: "Cal.com",
    description:
      "Cal.com is a scheduling tool that helps you schedule meetings without the back-and-forth emails.",
    href: "https://cal.com",
  },
  {
    name: "Crowd.dev",
    description:
      "Centralize community, product, and customer data to understand which companies are engaging with your open source project.",
    href: "https://www.crowd.dev",
  },
  {
    name: "Documenso",
    description:
      "The Open-Source DocuSign Alternative. We aim to earn your trust by enabling you to self-host the platform and examine its inner workings.",
    href: "https://documenso.com",
  },
  {
    name: "Erxes",
    description:
      "The Open-Source HubSpot Alternative. A single XOS enables to create unique and life-changing experiences ​​that work for all types of business.",
    href: "https://erxes.io",
  },
  {
    name: "Formbricks",
    description:
      "Survey granular user segments at any point in the user journey. Gather up to 6x more insights with targeted micro-surveys. All open-source.",
    href: "https://formbricks.com",
  },
  {
    name: "Forward Email",
    description:
      "Free email forwarding for custom domains. For 6 years and counting, we are the go-to email service for thousands of creators, developers, and businesses.",
    href: "https://forwardemail.net",
  },
  {
    name: "GitWonk",
    description:
      "GitWonk is an open-source technical documentation tool, designed and built focusing on the developer experience.",
    href: "https://gitwonk.com",
  },
  {
    name: "Hanko",
    description:
      "Open-source authentication and user management for the passkey era. Integrated in minutes, for web and mobile apps.",
    href: "https://www.hanko.io",
  },
  {
    name: "HTMX",
    description:
      "HTMX is a dependency-free JavaScript library that allows you to access AJAX, CSS Transitions, WebSockets, and Server Sent Events directly in HTML.",
    href: "https://htmx.org",
  },
  {
    name: "Infisical",
    description:
      "Open source, end-to-end encrypted platform that lets you securely manage secrets and configs across your team, devices, and infrastructure.",
    href: "https://infisical.com",
  },
  {
    name: "Novu",
    description:
      "The open-source notification infrastructure for developers. Simple components and APIs for managing all communication channels in one place.",
    href: "https://novu.co",
  },
  {
    name: "OpenBB",
    description:
      "Democratizing investment research through an open source financial ecosystem. The OpenBB Terminal allows everyone to perform investment research, from everywhere.",
    href: "https://openbb.co",
  },
  {
    name: "Sniffnet",
    description:
      "Sniffnet is a network monitoring tool to help you easily keep track of your Internet traffic.",
    href: "https://www.sniffnet.net",
  },
  {
    name: "Typebot",
    description:
      "Typebot gives you powerful blocks to create unique chat experiences. Embed them anywhere on your apps and start collecting results like magic.",
    href: "https://typebot.io",
  },
  {
    name: "Webiny",
    description:
      "Open-source enterprise-grade serverless CMS. Own your data. Scale effortlessly. Customize everything.",
    href: "https://www.webiny.com",
  },
];

export default function OSSFriendsPage() {
  return (
    <Layout title="OSS Friends" description="Open-source projects and tools for an open world.">
      <HeroTitle headingPt1="Our" headingTeal="Open-source" headingPt2="Friends" />
      <div className="m-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OSSFriends.map((friend, index) => (
          <div key={index} className="overflow-hidden rounded bg-slate-100 p-6 shadow-md">
            <a href={friend.href} className="mb-2 text-xl font-bold">
              {friend.name}
            </a>
            <p className="mt-4 text-sm text-gray-700">{friend.description}</p>
            <div className="mt-4">
              <Button target="_blank" variant="primary" href={friend.href}>
                Learn more
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
