import type { Template } from "@formbricks/types/templates";
import { useEffect, useState } from "react";
import PreviewSurvey from "./PreviewSurvey";
import TemplateList from "./TemplateList";
import { templates } from "./templates";

export default function SurveyTemplatesPage({}) {
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (templates.length > 0) {
      setActiveTemplate(templates[0]);
      setActiveQuestionId(templates[0]?.preset.questions[0]?.id || null);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-x-auto">
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <TemplateList
          activeTemplate={activeTemplate}
          onTemplateClick={(template) => {
            setActiveQuestionId(template.preset.questions[0].id);
            setActiveTemplate(template);
          }}
        />
        <aside className="group relative h-full flex-1 flex-shrink-0 overflow-hidden rounded-r-lg bg-slate-200 shadow-inner  dark:bg-slate-700 md:flex md:flex-col">
          {activeTemplate && (
            <PreviewSurvey
              activeQuestionId={activeQuestionId}
              questions={activeTemplate.preset.questions}
              brandColor="#94a3b8"
              setActiveQuestionId={setActiveQuestionId}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
