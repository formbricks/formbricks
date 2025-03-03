import CalComLogo from "@/images/cal-logo-light.svg";
import Peer from "@/images/peer.webp";
import { getTranslate } from "@/tolgee/server";
import { CheckCircle2Icon } from "lucide-react";
import Image from "next/image";

export const Testimonial = async () => {
  const t = await getTranslate();
  return (
    <div className="flex flex-col items-center justify-center bg-gradient-to-tr from-slate-100 to-slate-300">
      <div className="3xl:w-2/3 mb-10 space-y-8 px-12 xl:px-20">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{t("auth.testimonial_title")}</h2>
        </div>
        {/*  <p className="text-slate-600">
          Make customer-centric decisions based on data.
          <br /> Keep 100% data ownership.
        </p> */}
        <div className="space-y-2">
          <div className="flex space-x-2">
            <CheckCircle2Icon className="text-brand-dark h-6 w-6" />
            <p className="inline text-lg text-slate-800">{t("auth.testimonial_all_features_included")}</p>
          </div>
          <div className="flex space-x-2">
            <CheckCircle2Icon className="text-brand-dark h-6 w-6" />
            <p className="inline text-lg text-slate-800">{t("auth.testimonial_free_and_open_source")}</p>
          </div>
          <div className="flex space-x-2">
            <CheckCircle2Icon className="text-brand-dark h-6 w-6" />
            <p className="inline text-lg text-slate-800">{t("auth.testimonial_no_credit_card_required")}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-gradient-to-tr from-slate-100 to-slate-200 p-8">
          <p className="italic text-slate-700">{t("auth.testimonial_1")}</p>
          <div className="mt-4 flex items-center space-x-6">
            <Image
              src={Peer}
              alt="Cal.com Co-Founder Peer Richelsen"
              className="h-28 w-28 rounded-full border border-slate-200 shadow-sm"
            />
            <div>
              <p className="mb-1.5 text-sm text-slate-500">Peer Richelsen, Co-Founder Cal.com</p>
              <Image src={CalComLogo} alt="Cal.com Logo" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
