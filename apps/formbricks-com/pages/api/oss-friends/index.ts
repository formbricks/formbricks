import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // GET
  if (req.method === "GET") {
    return res.status(200).json({
      data: [
        {
          name: "Appsmith",
          description: "Build build custom software on top of your data.",
          href: "https://www.appsmith.com",
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
            "The Open-Source HubSpot Alternative. A single XOS enables to create unique and life-changing experiences that work for all types of business.",
          href: "https://erxes.io",
        },
        {
          name: "Formbricks",
          description:
            "Survey granular user segments at any point in the user journey. Gather up to 6x more insights with targeted micro-surveys. All open-source.",
          href: "https://formbricks.com",
        },
        {
          name: "Ghostfolio",
          description:
            "Ghostfolio is a privacy-first, open source dashboard for your personal finances. Designed to simplify asset tracking and empower informed investment decisions.",
          href: "https://ghostfol.io",
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
          name: "Mockoon",
          description: "Mockoon is the easiest and quickest way to design and run mock REST APIs.",
          href: "https://mockoon.com",
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
          name: "OpenStatus",
          description: "Open-source monitoring platform with beautiful status pages",
          href: "https://www.openstatus.dev",
        },
        {
          name: "Papermark",
          description:
            "Open-Source Docsend Alternative to securely share documents with real-time analytics.",
          href: "https://www.papermark.io/",
        },
        {
          name: "Requestly",
          description:
            "Makes frontend development cycle 10x faster with API Client, Mock Server, Intercept & Modify HTTP Requests and Session Replays.",
          href: "https://requestly.io",
        },
        {
          name: "Rivet",
          description: "Open-source solution to deploy, scale, and operate your multiplayer game.",
          href: "https://rivet.gg",
        },
        {
          name: "Sniffnet",
          description:
            "Sniffnet is a network monitoring tool to help you easily keep track of your Internet traffic.",
          href: "https://www.sniffnet.net",
        },
        {
          name: "Tolgee",
          description: "Software localization from A to Z made really easy.",
          href: "https://tolgee.io",
        },
        {
          name: "Trigger.dev",
          description:
            "Create long-running Jobs directly in your codebase with features like API integrations, webhooks, scheduling and delays.",
          href: "https://trigger.dev",
        },
        {
          name: "Typebot",
          description:
            "Typebot gives you powerful blocks to create unique chat experiences. Embed them anywhere on your apps and start collecting results like magic.",
          href: "https://typebot.io",
        },
        {
          name: "Twenty",
          description:
            "A modern CRM offering the flexibility of open-source, advanced features and sleek design.",
          href: "https://twenty.com",
        },
        {
          name: "Webiny",
          description:
            "Open-source enterprise-grade serverless CMS. Own your data. Scale effortlessly. Customize everything.",
          href: "https://www.webiny.com",
        },
        {
          name: "Webstudio",
          description: "Webstudio is an open source alternative to Webflow",
          href: "https://webstudio.is",
        },
        {
          name: "Spark.NET",
          description:
            "The .NET Web Framework for Makers. Build production ready, full-stack web applications fast without sweating the small stuff.",
          href: "https://spark-framework.net",
        },
      ],
    });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
