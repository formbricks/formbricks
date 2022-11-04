import Layout from "@/components/shared/Layout";
import HeroTitle from "@/components/shared/HeroTitle";
import Button from "../components/shared/Button";
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

const GetStartedPage = () => (
  <Layout
    title="Get started"
    description="Choose between managed form hosting in the cloud or self-hosting our open source software">
    <HeroTitle headingPt1="How do you want to" headingTeal="run" headingPt2="Formbricks?" />
    <div className="mb-32 grid grid-cols-2 gap-8 px-16">
      <div className="rounded-lg bg-gradient-to-b from-blue-200 to-gray-50 px-10 py-6 dark:from-blue-300 dark:to-gray-100">
        <CloudIcon className="h-20 w-20 flex-shrink-0 text-blue-500" />
        <h2 className="text-blue mt-7 text-4xl font-bold">Cloud</h2>
        <p className="text-sm text-gray-500">Managed hosting by Formbricks core team</p>
        <p className="mt-7 font-semibold">
          <span className="font-bold text-black">Free</span> for 500 submissions/mo
        </p>
        <p className="text-sm text-gray-500">then $0.01/submission</p>
        <div className="mt-7 flex items-center py-1">
          <InboxArrowDownIcon className="h- mr-3 w-7 flex-shrink-0 text-blue-500" />
          <p className="text-blue font-medium">Start receiving submissions right away</p>
        </div>
        <div className="flex items-center py-1">
          <ArrowPathIcon className="mr-3 h-7 w-7 flex-shrink-0 text-blue-500" />
          <p className="text-blue font-medium">Automatic upgrades</p>
        </div>
        <div className="flex items-center py-1">
          <PuzzlePieceIcon className="mr-3 h-7 w-7 flex-shrink-0 text-blue-500" />
          <p className="text-blue font-medium">All enterprise features included</p>
        </div>
        <Button className="mt-7 w-full text-center font-bold" variant="highlight">
          Start FREE on Formbricks Cloud
        </Button>
      </div>
      <div className="rounded-lg bg-gradient-to-b from-blue-200 to-gray-50 px-10 py-6 dark:from-blue-300 dark:to-gray-100">
        <ServerStackIcon className="h-20 w-20 flex-shrink-0 text-blue-500" />
        <h2 className="text-blue mt-7 text-4xl font-bold">Self-host</h2>
        <p className="text-sm text-gray-500">Submission data never leaves your infrastructure</p>
        <p className="mt-7 font-semibold">
          <span className="font-bold text-black">Free</span> for 500 submissions/mo
        </p>
        <p className="text-sm text-gray-500">then $0.01/submission</p>
        <div className="mt-7 flex items-center py-1">
          <ShieldCheckIcon className="h- mr-3 w-7 flex-shrink-0 text-blue-500" />
          <p className="text-blue font-medium">Easy deploy for most private cloud platforms</p>
        </div>
        <div className="flex items-center py-1">
          <CommandLineIcon className="mr-3 h-7 w-7 flex-shrink-0 text-blue-500" />
          <p className="text-blue font-medium">Full access to production instance</p>
        </div>
        <div className="flex items-center py-1">
          <BuildingLibraryIcon className="mr-3 h-7 w-7 flex-shrink-0 text-blue-500" />
          <p className="text-blue font-medium">Full compliance with all data privacy regulation</p>
        </div>
        <Button className="mt-7 w-full text-center font-bold" variant="highlight">
          Get started
        </Button>
      </div>
    </div>
  </Layout>
);

export default GetStartedPage;
