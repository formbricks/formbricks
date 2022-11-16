import Layout from "@/components/shared/Layout";
import HeroTitle from "@/components/shared/HeroTitle";
import Button from "../components/shared/Button";
import { useRouter } from "next/router";
import {
  CloudIcon,
  ArrowPathIcon,
  InboxArrowDownIcon,
  PuzzlePieceIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";

export default function GetStartedPage() {
  const router = useRouter();
  return (
    <Layout
      title="Get started"
      description="We offer our open source form & survey software for self-hosters and in our managed cloud. Get started within minutes!">
      <HeroTitle headingPt1="How do you want to" headingTeal="run" headingPt2="Formbricks?" />

      <div className="mb-32 grid px-6 md:grid-cols-2 md:gap-8 md:px-16">
        <div className="mb-6 rounded-lg bg-gradient-to-b from-slate-200 to-slate-300 px-10 py-6 dark:from-slate-800 dark:to-slate-700 md:mb-0">
          <CloudIcon className="h-20 w-20 flex-shrink-0 text-slate-600 dark:text-slate-400" />
          <h2 className="mt-7 text-4xl font-bold text-slate-800 dark:text-slate-200">Cloud</h2>
          <p className="text-sm text-slate-500">Managed hosting by Formbricks core team</p>
          <p className="mt-7 font-semibold text-slate-700 dark:text-slate-300">
            <span className="font-bold ">Free</span> for 500 submissions/mo
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">then $0.01/submission</p>
          <div className="font-medium text-slate-500 dark:text-slate-400">
            <div className="mt-7 flex items-center py-1">
              <InboxArrowDownIcon className="mr-3 h-7 w-7 flex-shrink-0 text-slate-600 dark:text-slate-300" />
              <p>Start receiving submissions right away</p>
            </div>
            <div className="flex items-center py-1">
              <ArrowPathIcon className="mr-3 h-7 w-7 flex-shrink-0 text-slate-600 dark:text-slate-300" />
              <p>Automatic upgrades</p>
            </div>
            <div className="flex items-center py-1">
              <PuzzlePieceIcon className="mr-3 h-7 w-7 flex-shrink-0 text-slate-600 dark:text-slate-300" />
              <p>All enterprise features included</p>
            </div>
          </div>
          <Button disabled className="mt-7 w-full justify-center text-center font-bold" variant="highlight">
            Start FREE on Formbricks Cloud
          </Button>
        </div>

        <div className="rounded-lg bg-gradient-to-b from-slate-200 to-slate-300 px-10 py-6 dark:from-slate-800 dark:to-slate-700 ">
          <ServerStackIcon className="h-20 w-20 flex-shrink-0 text-slate-600 dark:text-slate-400" />
          <h2 className="mt-7 text-4xl font-bold text-slate-800 dark:text-slate-200">Self-host</h2>
          <p className="text-sm text-gray-500">Submission data never leaves your infrastructure</p>
          <p className="mt-7 font-semibold text-slate-700 dark:text-slate-300">
            <span className="font-bold ">Free</span> for 500 submissions/mo
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">then $0.01/submission</p>
          <div className="font-medium text-slate-500 dark:text-slate-400">
            <div className="mt-7 flex items-center py-1">
              <ShieldCheckIcon className="h- mr-3 w-7 flex-shrink-0 text-slate-600 dark:text-slate-300" />
              <p>Easy deploy for most private cloud platforms</p>
            </div>
            <div className="flex items-center py-1">
              <CommandLineIcon className="mr-3 h-7 w-7 flex-shrink-0 text-slate-600 dark:text-slate-300" />
              <p>Full access to production instance</p>
            </div>
            <div className="flex items-center py-1">
              <BuildingLibraryIcon className="mr-3 h-7 w-7 flex-shrink-0 text-slate-600 dark:text-slate-300" />
              <p>Full compliance with all data privacy regulation</p>
            </div>
          </div>
          <Button
            className="mt-7 w-full justify-center text-center font-bold"
            variant="highlight"
            onClick={() => router.push("/discord")}>
            Sign up for beta test
          </Button>
        </div>
      </div>
    </Layout>
  );
}
