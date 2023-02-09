import { useRouter } from "next/router";
import { Button } from "@formbricks/ui";
import Image from "next/image";
import EarlyBird from "@/images/early bird deal for open source jotform alternative typeform and surveymonkey_v2.svg";

export default function EarlyBirdDeal() {
  const router = useRouter();
  return (
    <div className="bg-brand-dark relative mx-4 max-w-7xl overflow-hidden rounded-xl p-6 pb-16 sm:p-8 sm:pb-16 md:py-8 md:px-12 lg:flex lg:items-center">
      <div className="lg:w-0 lg:flex-1 ">
        <h2
          className="mb-1 text-2xl font-bold tracking-tight text-white sm:text-2xl"
          id="newsletter-headline">
          50% off for early birds.
        </h2>
        <h2 className="text-xl font-semibold tracking-tight text-slate-200 sm:text-lg">
          Limited Early Bird deal. Only{" "}
          <span className="bg- rounded-sm bg-slate-200/40 px-2 py-0.5 text-slate-100">17</span> left.
        </h2>

        <div className="mt-6">
          <Button
            variant="secondary"
            target="_blank"
            onClick={() => router.push("https://app.formbricks.com/auth/signup")}>
            Get Early Bird Deal
          </Button>
        </div>
        <p className="mt-2 mb-24 max-w-3xl text-xs tracking-tight text-slate-200 md:mb-0 md:max-w-sm lg:max-w-none">
          This saves you $588 every year.
        </p>
        <div className="absolute -right-20 -bottom-36 mx-auto h-96 w-96 scale-75 sm:-right-10">
          <Image src={EarlyBird} fill alt="formbricks favicon open source forms typeform alternative" />
        </div>
      </div>
    </div>
  );
}
