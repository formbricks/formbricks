import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

const XMOffer = [
  {
    step: "1",
    header: "Kick-off call",
    description: "You share with our experienced PMs which areas of your experience need improvement.",
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
        layout: "month_view",
      });
    })();
  }, []);

  return (
    <Layout
      title="Community | Formbricks Open Source Forms & Surveys"
      description="You're building open source forms and surveys? So are we! Get support for anything your building - or just say hi!">
      <HeroTitle
        headingPt1="XM"
        headingTeal="Concierge"
        headingPt2="Service"
        subheading="Let's set up your system for continuous user discovery together."
      />
      <div className="grid grid-cols-1 px-4 md:grid-cols-2 md:gap-8 md:px-16">
        <div className="rounded-xl bg-slate-100 p-12">
          <h3 className="mb-8 text-2xl font-semibold text-slate-400">What you get:</h3>
          {XMOffer.map((offer) => (
            <div key={offer.step} className="mb-8 flex items-center gap-x-4">
              <div className=" flex items-center justify-center rounded-full bg-emerald-50 p-4 text-2xl font-bold text-emerald-900">
                {offer.step}
              </div>
              <div>
                <h4 className="font-semibold text-slate-700">{offer.header}</h4>
                <p className="text-sm text-slate-800">{offer.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl">
          <Cal
            calLink="johannes/concierge-kick-off"
            style={{
              width: "100%",
              height: "100%",
              overflow: "scroll",
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
