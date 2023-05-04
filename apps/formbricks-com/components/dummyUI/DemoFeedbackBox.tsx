import { createId } from "@paralleldrive/cuid2";
import { useState } from "react";
import PreviewSurvey from "./PreviewSurvey";
import type { Template } from "./templateTypes";

export default function DemoFeedbackBox() {
  const [localTemplateName, setLocalTemplateName] = useState("templateName");

  const FeedbackBox: Template = {
    name: "Feedback Box",
    category: "Product Management",
    description: "Give your users the chance to seamlessly share what's on their minds.",
    preset: {
      name: "Feedback Box",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What's on your mind, boss?",
          subheader: "Thanks for sharing. We'll get back to you asap.",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Bug report 🐞",
            },
            {
              id: createId(),
              label: "Feature Request 💡",
            },
          ],
        },
        {
          id: createId(),
          type: "openText",
          headline: "Give us the juicy details:",
          required: true,
        },
      ],
    },
  };

  return (
    <div>
      <div className="mt-6 hidden flex-col md:flex">
        {FeedbackBox && (
          <PreviewSurvey
            activeQuestionId={null}
            questions={FeedbackBox.preset.questions}
            brandColor="#00C4B8"
          />
        )}
      </div>

      <div className="flex items-center justify-center pt-36 text-slate-600 md:hidden">
        This demo is not yet optimized for smartphones.
      </div>
    </div>
  );
}
