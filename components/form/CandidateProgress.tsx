import { useState, useEffect } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

function CandidateProgress({ formId }) {
  const [progress, setProgress] = useState();

  const candidateProgress = async () => {
    try {
      const progress = await fetch(`/api/public/forms/${formId}/nocodeform`, {
        method: "GET",
      });

      if (progress && progress.ok !== "ok") {
        console.error("error");
      }
      const data = await progress.json();
      setProgress(data.events.length);
    } catch (error) {}
  };
  useEffect(() => {
    candidateProgress();
  }, []);

  return (
    <div className="flex items-center px-3 py-1 text-xs font-bold text-neutral-500">
      <span className="flex items-center mr-1">
        <CheckCircleIcon className="w-5 h-5 text-black mr-2" />
        {`${progress} / n`}
      </span>
    </div>
  );
}

export default CandidateProgress;
