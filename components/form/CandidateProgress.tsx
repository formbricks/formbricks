import { useState, useEffect } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import usePages from "../../hooks/usePages";
// import { getFormPages, getFormPage} from "../../lib/forms";

function CandidateProgress({ form }) {

  const [progress, setProgress] = useState(0);
  const pages = usePages({ blocks: form.noCodeForm.blocks, formId: form.id });

  const candidateProgress = async () => {
    try {
      const progress = await fetch(`/api/public/forms/${form.id}/nocodeform`, {
        method: "GET",
      });

      if (progress && !progress.ok) {
        console.error("error");
      }
      const data = await progress.json();
      setProgress(data ? data.events.length : 0);
    } catch (error) {}
  };
  useEffect(() => {
    candidateProgress();
  }, []);

  return (
    <div className="flex items-center px-3 py-1 text-xs font-bold text-neutral-500">
      <span className="flex items-center mr-1">
        <CheckCircleIcon className="w-5 h-5 text-black mr-2" />
        { progress < (pages.length - 1)?`${progress} / ${(pages.length - 1)}`: "completed"}
      </span>
    </div>
  );
}

export default CandidateProgress;
