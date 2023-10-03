import HackIconGold from "@/images/formtribe/hack-icon-gold.svg";
import Image from "next/image";
import Link from "next/link";

export const GitHubSponsorship: React.FC = () => {
  return (
    <div className="mx-4 my-4 mb-12 mt-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-8 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700 sm:px-6 sm:pb-12 sm:pt-8 md:max-w-none lg:mt-6 lg:px-8 lg:pt-8">
      <style jsx>{`
        @media (min-width: 426px);
      `}</style>
      <div className="right-24 lg:absolute">
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
        <Image
          src={HackIconGold}
          alt="Hacktober Icon Gold"
          width={100}
          height={100}
          className="mr-12 md:mr-4"
        />
      </div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 lg:text-2xl">
        The FormTribe goes Hacktoberfest 🥨
      </h2>
      <p className="lg:text-md mt-4 max-w-3xl  text-slate-500 dark:text-slate-400">
        Write code, win a Mac! We&apos;re running a Hacktoberfest community Hackathon:
        <span>
          <Link href="/formtribe" className="decoration-brand-dark ml-2 underline underline-offset-4">
            Find out more.
          </Link>
        </span>
      </p>
    </div>
  );
};

export default GitHubSponsorship;
