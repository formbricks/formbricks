import { useEffect, useState } from "react";
import { useForm } from "../../lib/forms";
import { getFormSummaryStats } from "../../lib/submissionSessions";
import { isBlockAQuestion } from "../../lib/utils";
import AnalyticsCard from "./AnalyticsCard";
import Loading from "../Loading";
import usePages from "../../hooks/usePages";

type SummaryStatsType = {
  opened: number;
  submitted: number;
  pages: any;
} | null;

export default function ResultsSummary({ formId }) {
  const [summaryStats, setSummaryStats] = useState<SummaryStatsType>(null);

  useEffect(() => {
    (async () => {
      const data = await getFormSummaryStats(formId);
      if (data) setSummaryStats(data);
    })();
  }, []);

  const { form, isLoadingForm } = useForm(formId);
  const [formBlocks, setFormBlocks] = useState([]);
  const getFormQuestions = (page) => {
    return page.blocks.filter((b) => isBlockAQuestion(b));
  };

  const getNocodeFormBlocks = async () => {
    try {
      const progress = await fetch(`/api/public/forms/${form.id}/nocodeform`, {
        method: "GET",
      });

      if (progress && !progress.ok) {
        console.error("error");
      }
      const data = await progress.json();
      setFormBlocks(data?.form?.blocks);
    } catch (error) {}
  };

  useEffect(() => {
    getNocodeFormBlocks();
  }, []);

  const pages = usePages({ blocks: formBlocks, formId });

  const defaultInsights = [
    {
      id: "totalCandidateOpenedForm",
      name: "Nombre de candidats ayant vu",
      stat: summaryStats ? summaryStats.opened : 0,
      trend: undefined,
      toolTipText: undefined,
    },
    {
      id: "totalCandidateSubmited",
      name: "Nombre de candidats ayant soumis",
      stat: summaryStats
        ? `${summaryStats.submitted} (${Math.round(
            (summaryStats.submitted / summaryStats.opened) * 100
          )}%)`
        : 0,
      trend: undefined,
      toolTipText: undefined,
    },
    // {
    //   id: "lastSubmission",
    //   name: "Dernière soumission",
    //   stat: insights.lastSubmissionAt
    //     ? timeSince(insights.lastSubmissionAt)
    //     : "--",
    //   smallerText: true,
    //   toolTipText: undefined,
    // },
  ];

  if (!summaryStats) {
    return <Loading />;
  }

  return (
    <>
      <h2 className="mt-8 text-xl font-bold text-ui-gray-dark max-sm:pl-4 max-md:pl-4">
        General report
      </h2>
      <dl className="grid grid-cols-1 gap-5 mt-8 sm:grid-cols-2">
        {defaultInsights.map((item) => (
          <AnalyticsCard
            key={item.id}
            value={
              item.type === "page"
                ? `${item.stat} candidats ont répondus`
                : item.stat
            }
            label={item.name}
            toolTipText={item.toolTipText}
            trend={item.trend}
            smallerText={item.smallerText}
            questions={item.questions}
          />
        ))}
      </dl>

      <h2 className="mt-8 text-xl font-bold text-ui-gray-dark max-sm:pl-4 max-md:pl-4">
        Diférentes étapes
      </h2>
      <dl className="grid  gap-5 mt-8 mb-12 ">
        {pages.slice(0, pages.length-1).map((page) => (
          <AnalyticsCard
            key={page.id}
            value={`${summaryStats?.pages[page.id]} candidats ont répondus`}
            label={page.blocks[0].data.text}
            toolTipText={page.toolTipText}
            trend={page.trend}
            smallerText={page.smallerText}
            questions={getFormQuestions(page)}
            formId={formId}
            pageId={page.id}
          />
        ))}
      </dl>
      {/* <div>
        {summary?.pages &&
          summary.pages.map(
            (page) =>
              page.type === "form" && (
                <div key={page.name}>
                  {page.elements.map((element, idx) =>
                    [
                      "email",
                      "number",
                      "phone",
                      "text",
                      "textarea",
                      "website",
                    ].includes(element.type) ? (
                      <TextResults element={element} key={idx} />
                    ) : ["checkbox", "radio"].includes(element.type) ? (
                      <ChoiceResults element={element} key={idx} />
                    ) : null
                  )}
                </div>
              )
          )}
      </div> */}
    </>
  );
}
