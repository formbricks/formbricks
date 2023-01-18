import Button from "../shared/Button";
import HeroAnimation from "../shared/HeroAnimation";
import { useRouter } from "next/router";

interface Props {}

export default function Hero({}: Props) {
  const router = useRouter();
  return (
    <div className="relative">
      <div className="px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          <span className="xl:inline">Build</span>{" "}
          <span className="from-brand-light to-brand-dark bg-gradient-to-b bg-clip-text text-transparent xl:inline">
            user research
          </span>{" "}
          <span className="inline ">into your product</span>
        </h1>

        <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-500 dark:text-slate-300 sm:text-lg md:mt-5 md:text-xl">
          Natively embed qualitative user research into your B2B SaaS.
          <br />
          <span className="hidden md:block">
            Leverage Best Practices for user discovery to increase Product-Market Fit.
          </span>
        </p>

        <div className="mx-auto mt-5 max-w-md sm:flex sm:justify-center md:mt-8">
          <Button variant="secondary" onClick={() => router.push("#best-practices")}>
            Best practices
          </Button>
          <Button variant="primary" className="ml-3" onClick={() => router.push("/waitlist")}>
            Get Access
          </Button>
        </div>
      </div>

      <HeroAnimation />
    </div>
  );
}
