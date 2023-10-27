import PHIcon from "@/images/formtribe/ph-logo.png";
import Image from "next/image";
import Link from "next/link";

export const GitHubSponsorship: React.FC = () => {
  return (
    <Link href="https://www.producthunt.com/products/formbricks" target="_blank">
      <div className="my-12 grid w-full grid-cols-3 rounded-2xl border border-[#ff6154] bg-gradient-to-br from-slate-100 to-slate-200 p-12 transition-all hover:scale-105 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700">
        {/*         <Image
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
          className="mr-12 hidden dark:block md:mr-4"
        /> */}

        <div className="col-span-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 lg:text-2xl">
            We are live on ProductHunt today 🚀
          </h2>
          <p className="lg:text-md mt-2 max-w-3xl  text-slate-500 dark:text-slate-400">
            Support our open source project with an upvote and comment.
            <span>
              <Link
                href="https://www.producthunt.com/products/formbricks"
                className="ml-2 underline decoration-[#ff6154] underline-offset-4"
                target="_blank">
                View launch post.
              </Link>
            </span>
          </p>
        </div>
        <div className="flex items-center justify-end">
          <Image src={PHIcon} alt="Product Hunt Logo" width={80} className="" />
        </div>
      </div>
    </Link>
  );
};

export default GitHubSponsorship;
