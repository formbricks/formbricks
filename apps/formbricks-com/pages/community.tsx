import Layout from "@/components/shared/Layout";
import HeroTitle from "@/components/shared/HeroTitle";
import Button from "../components/shared/Button";
import {
  CloudIcon,
  ArrowPathIcon,
  InboxArrowDownIcon,
  PuzzlePieceIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";

const GetStartedPage = () => (
  <Layout meta={{ title: "React Form Builder Library by Formbricks" }}>
    <HeroTitle HeadingPt1="Join the" HeadingTeal="Formbricks" HeadingPt2="Community" />
    <div className="grid grid-cols-2 gap-8 px-16 mb-32">
      <div className="px-10 py-6 rounded-lg bg-gradient-to-b from-blue-200 to-gray-50 dark:from-blue-300 dark:to-gray-100">
        <CloudIcon className="flex-shrink-0 w-20 h-20 text-blue-500" />
        <h2 className="text-4xl font-bold mt-7">Cloud</h2>
        <p className="text-sm text-gray-500">Managed hosting by Formbricks core team</p>
        <p className="font-semibold mt-7">
          <span className="font-bold">Free</span> for 500 submissions/mo
        </p>
        <p className="text-sm text-gray-500">then $0.01/submission</p>
        <div className="flex items-center py-1 mt-7">
          <InboxArrowDownIcon className="flex-shrink-0 mr-3 text-blue-500 h- w-7" />
          <p className="font-medium">Start receiving submissions right away</p>
        </div>
        <div className="flex items-center py-1">
          <ArrowPathIcon className="flex-shrink-0 mr-3 text-blue-500 h-7 w-7" />
          <p className="font-medium">Automatic upgrades</p>
        </div>
        <div className="flex items-center py-1">
          <PuzzlePieceIcon className="flex-shrink-0 mr-3 text-blue-500 h-7 w-7" />
          <p className="font-medium">All enterprise features included</p>
        </div>
        <Button className="w-full font-bold text-center mt-7" variant="highlight">
          Start FREE on Formbricks Cloud
        </Button>
      </div>
      <div className="px-10 py-6 rounded-lg bg-gradient-to-b from-blue-200 to-gray-50 dark:from-blue-300 dark:to-gray-100">
        <ServerStackIcon className="flex-shrink-0 w-20 h-20 text-blue-500" />
        <h2 className="text-4xl font-bold mt-7">Self-host</h2>
        <p className="text-sm text-gray-500">Submission data never leaves your infrastructure</p>
        <p className="font-semibold mt-7">
          <span className="font-bold">Free</span> for 500 submissions/mo
        </p>
        <p className="text-sm text-gray-500">then $0.01/submission</p>
        <div className="flex items-center py-1 mt-7">
          <InboxArrowDownIcon className="flex-shrink-0 mr-3 text-blue-500 h- w-7" />
          <p className="font-medium">Easy deploy for most private cloud platforms</p>
        </div>
        <div className="flex items-center py-1">
          <ArrowPathIcon className="flex-shrink-0 mr-3 text-blue-500 h-7 w-7" />
          <p className="font-medium">Full access to production instance</p>
        </div>
        <div className="flex items-center py-1">
          <PuzzlePieceIcon className="flex-shrink-0 mr-3 text-blue-500 h-7 w-7" />
          <p className="font-medium">Full compliance with all data privacy regulation</p>
        </div>
        <Button className="w-full font-bold text-center mt-7" variant="highlight">
          Get started
        </Button>
      </div>
    </div>
  </Layout>
);

export default GetStartedPage;
