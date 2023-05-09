// DemoPreview.tsx
import React, { useEffect, useState } from "react";
import PreviewSurvey from "./PreviewSurvey";
import { findTemplateByName } from "./templates";
import type { Template } from "./templateTypes";

interface DemoPreviewProps {
  template: string;
}

const DemoPreview: React.FC<DemoPreviewProps> = ({ template }) => {
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const selectedTemplate: Template | undefined = findTemplateByName(template);

  useEffect(() => {
    if (selectedTemplate) {
      setActiveQuestionId(selectedTemplate.preset.questions[0].id);
    }
  }, [selectedTemplate]);

  if (!selectedTemplate) {
    return <div>Template not found.</div>;
  }

  console.log(selectedTemplate);
  return (
    <div className="flex items-center justify-center rounded-xl border-2 border-slate-300 bg-slate-200 py-6 transition-transform duration-150">
      <div className="flex flex-col items-center justify-around">
        <p className="my-3 text-sm text-slate-500">Preview</p>
        <div className="hidden flex-col md:flex">
          {selectedTemplate && (
            <PreviewSurvey
              activeQuestionId={activeQuestionId}
              questions={selectedTemplate.preset.questions}
              brandColor="#94a3b8"
              setActiveQuestionId={setActiveQuestionId}
            />
          )}
        </div>
        <div className="flex items-center justify-center pt-36 text-slate-600 md:hidden">
          This demo is not yet optimized for smartphones.
        </div>
      </div>
    </div>
  );
};

export default DemoPreview;
