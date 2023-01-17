import IconRadio from "@/components/engine/IconRadio";
import { Survey } from "@/components/engine/Survey";
import Textarea from "@/components/engine/Textarea";
import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";

const WaitlistPage = () => (
  <Layout
    title="Webhooks"
    description="Don't be limited by our choice of integrations, pipe your data exactly where you need it.">
    <h1 className="my-10 text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
      Join Waitlist
    </h1>
    <div className="mb-20 h-96">
      <Survey
        survey={{
          pages: [
            {
              id: "targetGroupPage",
              config: {
                autoSubmit: true,
              },
              questions: [
                {
                  id: "targetGroup",
                  type: "radio",
                  label: "Who are you serving?",
                  field: "targetGroup",
                  options: [
                    { label: "Companies", value: "companies" },
                    { label: "Consumers", value: "consumers" },
                  ],
                  component: IconRadio,
                },
              ],
            },
            {
              id: "wauPage",
              questions: [
                {
                  id: "wau",
                  type: "radio",
                  label: "How many weekly active users do you have?",
                  field: "targetGroup",
                  options: [
                    { label: "0-100", value: "0-100" },
                    { label: "100-1000", value: "100-1000" },
                    { label: "1000-10000", value: "1000-10000" },
                    { label: "10000+", value: "10000+" },
                  ],
                  component: IconRadio,
                },
                {
                  id: "comment",
                  type: "textarea",
                  label: "Do you want to add a comment?",
                  field: "comment",
                  options: [],
                  component: Textarea,
                },
              ],
            },
          ],
        }}
      />
    </div>
  </Layout>
);

export default WaitlistPage;
