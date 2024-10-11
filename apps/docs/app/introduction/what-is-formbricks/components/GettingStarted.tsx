import { Button } from "@/components/Button";
import { Heading } from "@/components/Heading";

const gettingStarted = [
  {
    href: "/website-surveys/framework-guides",
    name: "Quickstart",
    description: "Get up and running with our cloud and JavaScript widget for public-facing website surveys",
  },
  {
    href: "/website-surveys/framework-guides#next-js",
    name: "Next.js App",
    description:
      "Integrate the Formbricks Website Survey SDK into a Next.js application with the new app directory",
  },
  {
    href: "/self-hosting/one-click",
    name: "Self Host Single Click Deployment",
    description:
      "Host Formbricks on your own servers with just a single script. No need to worry about setting up databases, queues, or caches.",
  },
  {
    href: "/best-practices/interview-prompt",
    name: "Interview Prompt",
    description: "Set user interviews on autopilot for a continuous stream of interviews.",
  },
];

export const GettingStarted = () => {
  return (
    <div className="my-16 xl:max-w-none">
      <Heading level={2} id="getting-started">
        Quick Resources
      </Heading>
      <div className="not-prose mt-4 grid grid-cols-1 gap-8 border-t border-slate-900/5 pt-10 sm:grid-cols-2 xl:grid-cols-4 dark:border-white/5">
        {gettingStarted.map((guide) => (
          <div key={guide.href}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{guide.name}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{guide.description}</p>
            <p className="mt-4">
              <Button href={guide.href} variant="text" arrow="right">
                Read more
              </Button>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
