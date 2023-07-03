import Layout from "@/components/shared/Layout";
import HeroTitle from "@/components/shared/HeroTitle";
import { Button } from "@formbricks/ui";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { ChatBubbleOvalLeftEllipsisIcon, EnvelopeIcon } from "@heroicons/react/24/solid";

const topContributors = [
  {
    name: "Midka",
    href: "https://github.com/kymppi",
  },
  {
    name: "Pandeyman",
    href: "https://github.com/pandeymangg",
  },
  {
    name: "Ashu",
    href: "https://github.com/Ashutosh-Bhadauriya",
  },
  {
    name: "Timothy",
    href: "https://github.com/timothyde",
  },
  {
    name: "Shubhdeep",
    href: "https://github.com/Shubhdeep12",
  },
];

const CommunityPage = () => {
  const router = useRouter();
  return (
    <Layout
      title="Community | Formbricks Open Source Forms & Surveys"
      description="You're building open source forms and surveys? So are we! Get support for anything your building - or just say hi!">
      <HeroTitle headingPt1="Join the" headingTeal="Formbricks" headingPt2="Community 🤍" />
      <div className="mb-32 grid grid-cols-1 px-4 md:grid-cols-2 md:gap-8 md:px-16">
        <div className="mb-6 rounded-lg bg-gradient-to-b from-slate-200 to-slate-300 px-10 py-6 dark:from-slate-800 dark:to-slate-700 md:mb-0">
          <h2 className="mt-7 text-3xl font-bold text-slate-800 dark:text-slate-200 xl:text-4xl">
            Top Contributors
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Super thankful to have you guys contribute for Formbricks 🙌
          </p>
          <ol className="ml-4 mt-10 list-decimal">
            {topContributors.map((MVP) => (
              <li
                key={MVP.name}
                className="my-3 text-lg font-bold text-slate-700 hover:text-slate-600 dark:text-slate-300 dark:hover:text-slate-400">
                <a href={MVP.href} className="" target="_blank" rel="noreferrer">
                  {MVP.name}

                  <ArrowTopRightOnSquareIcon className="text-brand-dark dark:text-brand-light mb-1 ml-1 inline h-5 w-5" />
                </a>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="rounded-lg bg-gradient-to-b from-slate-200 to-slate-300 px-10 pb-12 pt-6 dark:from-slate-800 dark:to-slate-700">
            <h3 className="mt-7 text-3xl font-bold text-slate-800 dark:text-slate-200 xl:text-4xl">
              Community Discord
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Get support for anything your building - or just say hi 👋
            </p>
            <Button
              className="mt-7 w-full justify-center"
              variant="highlight"
              onClick={() => router.push("/discord")}>
              Join Discord <ChatBubbleOvalLeftEllipsisIcon className="ml-1 inline h-5 w-5" />
            </Button>
          </div>
          <div className="mt-7 flex">
            <a
              href="https://twitter.com/formbricks"
              target="_blank"
              rel="noreferrer"
              className="delay-50 w-1/2 transition ease-in-out hover:scale-105">
              <div className="mr-3 flex justify-center rounded-lg bg-gradient-to-b from-slate-200 to-slate-300 py-6 dark:from-slate-800 dark:to-slate-700">
                <svg fill="currentColor" viewBox="0 0 24 24" className="h-20 w-20 text-[#1DA1F2]">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </div>
            </a>
            <a
              href="mailto:hola@formbricks.com"
              className="delay-50 w-1/2 transition ease-in-out hover:scale-105">
              <div className="ml-3 flex justify-center rounded-lg bg-gradient-to-b from-slate-200 to-slate-300 py-6 dark:from-slate-800 dark:to-slate-700">
                <EnvelopeIcon className="ml-1 h-20 w-20 text-slate-400 " />
              </div>
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CommunityPage;
