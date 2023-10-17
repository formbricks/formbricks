import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import Cal, { getCalApi } from "@calcom/embed-react";
import { Button } from "@formbricks/ui/Button";
import { useEffect } from "react";

const XMOffer = [
  {
    step: "1",
    header: "Kick-off call",
    description: "Share with our seasoned PMs which areas of customer experience need improvement.",
  },
  {
    step: "2",
    header: "In-depth analysis",
    description: "With a fresh pair of eyes, we analyze your customer experience to uncover potential.",
  },
  {
    step: "3",
    header: "Research design",
    description: "We set up systems for continuous discovery. Benefit from an ongoing stream of insights.",
  },
  {
    step: "4",
    header: "Setup assistance",
    description: "Our core developers help you get Formbricks up and running in no more than 60 minutes.",
  },
  {
    step: "5",
    header: "Actionable insights",
    description:
      "Once the results are in, we perform a thorough analysis and derive concrete Next Action Steps to retain your customers better.",
  },
];

const ConciergePage = () => {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      cal("ui", {
        theme: "light",
        styles: { branding: { brandColor: "#000000" } },
        hideEventTypeDetails: false,
      });
    })();
  }, []);

  return (
    <Layout
      title="Concierge | Formbricks Open Source Experience Management"
      description="We help you get started! Get the worry-free setup with our guidance.">
      <HeroTitle
        headingPt1=""
        headingTeal="Concierge"
        headingPt2="Service"
        subheading="Let's set up your system for continuous user discovery together."
      />
      <div className="flex flex-col justify-center gap-2 px-3 md:flex-row">
        <div className="rounded-xl bg-slate-100 p-12 md:w-[50%]">
          {XMOffer.map((offer) => (
            <div key={offer.step} className="mb-8 flex items-center gap-x-4">
              <div className=" flex items-center justify-center rounded-full bg-emerald-50 p-4 text-2xl font-bold text-emerald-700">
                {offer.step}
              </div>
              <div>
                <h4 className="font-semibold text-slate-700">{offer.header}</h4>
                <p className="text-sm text-slate-800">{offer.description}</p>
              </div>
            </div>
          ))}
          {/*           <div className="border-b border-t border-slate-300 p-6  text-4xl font-semibold text-slate-800">
            <p className="mr-2 font-light">$1.290</p>
          </div>
             {          <div className="border-t border-slate-300 p-6 text-sm text-slate-800">
            <p>
              <CheckBadgeIcon className="mr-1 inline h-5 w-5 text-slate-800" />
              100% Risk-free: Pay after the kick-off call, if you liked it.
            </p>
            <p>
              <CheckBadgeIcon className="mr-1 inline h-5 w-5 text-slate-800" />
              Money-back: If you&apos;re not happy, get a full refund.
            </p>
          </div> */}
          <div className="px-6">
            <Button
              // variant="darkCTA"
              className="w-full justify-center bg-gray-800 text-gray-300 hover:text-white"
              href="https://cal.com/johannes/kick-off"
              target="_blank">
              Schedule free Kick-Off call
            </Button>
          </div>
        </div>
        <div className="ml-2 w-full rounded-xl md:w-[40%]">
          <Cal
            calLink="johannes/kick-off"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "0.5rem",
            }}
            config={{ layout: "month_view" }}
          />
        </div>
      </div>
    </Layout>
  );
};

export default ConciergePage;
