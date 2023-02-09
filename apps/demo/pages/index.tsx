import Link from "next/link";

const demos = [
  {
    name: "Feedback",
    description: "Shows Formbricks Feedback Widget in action",
    href: "/demos/feedback",
  },
  {
    name: "Feedback Custom",
    description: "Custom-built feedback widget using Formbricks React Library",
    href: "/demos/feedback-custom",
  },
  {
    name: "Product Market Fit",
    description: "Shows Formbricks PMF Widget in action",
    href: "/demos/pmf",
  },
  {
    name: "Poll Results",
    description:
      "Shows how you can use Formbricks to build a customer poll and show the results to your users",
    href: "/demos/poll-results",
  },
];

export default function DemosOverview() {
  return (
    <div className="w-full justify-center py-8 px-8">
      <h1 className="my-8 text-center text-2xl font-bold leading-4 text-slate-800">Formbricks Demos</h1>
      <div className="mx-auto grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-1">
        {demos.map((demo) => (
          <div
            key={demo.name}
            className="relative flex items-center space-x-3 rounded-lg border border-slate-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 hover:border-slate-400">
            <div className="min-w-0 flex-1">
              <Link href={demo.href} className="focus:outline-none" target="_blank">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-900">{demo.name}</p>
                <p className="truncate text-sm text-slate-500">{demo.description}</p>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
