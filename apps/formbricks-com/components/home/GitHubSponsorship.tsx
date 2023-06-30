import GitHubMarkWhite from "@/images/github-mark-white.svg";
import GitHubMarkDark from "@/images/github-mark.svg";
import Image from "next/image";
import Link from "next/link";

export const GitHubSponsorship: React.FC = () => {
  return (
    <div className="xs:mx-auto xs:w-full relative mx-auto my-4 mb-12 mt-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-8 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700  sm:px-6 sm:pb-12 sm:pt-8  md:max-w-none lg:mt-6 lg:px-8 lg:pt-8 ">
      <div className="right-10 lg:absolute">
        <Image
          src={GitHubMarkDark}
          alt="GitHub Sponsors Formbricks badge"
          width={100}
          height={100}
          className="mr-12 block dark:hidden md:mr-4 "
        />
        <Image
          src={GitHubMarkWhite}
          alt="GitHub Sponsors Formbricks badge"
          width={100}
          height={100}
          className="mr-12 hidden dark:block md:mr-4  "
        />
      </div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 lg:text-2xl">
        Proudly Open-Source 🤍
      </h2>
      <p className="lg:text-md mt-4 max-w-3xl  text-slate-500 dark:text-slate-400">
        We&apos;re proud to to be supported by GitHubs Open-Source Program!{" "}
        <span>
          <Link
            href="/blog/inaugural-batch-github-accelerator"
            className="decoration-brand-dark underline underline-offset-4">
            Read more.
          </Link>
        </span>
      </p>
    </div>
  );
};

export default GitHubSponsorship;
